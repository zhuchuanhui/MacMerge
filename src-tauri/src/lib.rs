use serde::Serialize;
use similar::{ChangeTag, TextDiff};
use std::{fs::OpenOptions, io::Write, panic::{catch_unwind, AssertUnwindSafe}, path::Path};
#[derive(Debug, Serialize)] #[serde(rename_all = "camelCase")] struct DocumentContent { text: String, format: &'static str, page_count: Option<usize> }
#[derive(Serialize)] struct Row { kind: &'static str, left: Option<usize>, right: Option<usize>, text: String }
#[derive(Serialize)] struct Hunk { start: usize, end: usize }
#[derive(Serialize)] struct DiffResult { rows: Vec<Row>, hunks: Vec<Hunk> }
#[tauri::command]
fn compare_text(left: String, right: String) -> DiffResult {
 let diff=TextDiff::from_lines(&left,&right); let mut rows=Vec::new(); let(mut l,mut r)=(1usize,1usize);
 for c in diff.iter_all_changes(){ match c.tag(){ ChangeTag::Equal=>{rows.push(Row{kind:"equal",left:Some(l),right:Some(r),text:c.to_string().trim_end_matches('\n').to_string()});l+=1;r+=1}, ChangeTag::Delete=>{rows.push(Row{kind:"delete",left:Some(l),right:None,text:c.to_string().trim_end_matches('\n').to_string()});l+=1}, ChangeTag::Insert=>{rows.push(Row{kind:"insert",left:None,right:Some(r),text:c.to_string().trim_end_matches('\n').to_string()});r+=1} } }
 let mut hunks=Vec::new();let mut i=0;while i<rows.len(){if rows[i].kind=="equal"{i+=1;continue}let start=i;while i<rows.len()&&rows[i].kind!="equal"{i+=1}hunks.push(Hunk{start,end:i});}
 DiffResult{rows,hunks}
}
#[tauri::command]
fn read_text_document(path: String) -> Result<DocumentContent, String> {
 let target = Path::new(&path);
 let metadata = std::fs::metadata(target).map_err(|e| e.to_string())?;
 if !metadata.is_file() { return Err("フォルダは比較できません。テキストまたはPDFファイルを選択してください".into()); }
 if metadata.len() > 20 * 1024 * 1024 { return Err("ファイルは20MB以下にしてください".into()); }
 if target.extension().and_then(|s| s.to_str()).map(|s| s.eq_ignore_ascii_case("pdf")).unwrap_or(false) {
  let extracted = catch_unwind(AssertUnwindSafe(|| pdf_extract::extract_text_by_pages(target)))
   .map_err(|_| "このPDFの文字形式には対応していません。別のPDF、またはテキスト形式で保存したファイルを選択してください".to_string())?;
  let pages = extracted.map_err(|e| format!("PDFを読み取れませんでした（パスワード保護・破損・未対応形式の可能性があります）: {e}"))?;
  let page_count = pages.len();
  let text = pages.iter().enumerate().map(|(index, page)| format!("--- ページ {} ---\n{}", index + 1, page.trim())).collect::<Vec<_>>().join("\n\n");
  if pages.is_empty() || pages.iter().all(|page| page.trim().is_empty()) { return Err("PDFからテキストを抽出できませんでした。スキャン画像のみのPDFは現在比較できません".into()); }
  return Ok(DocumentContent { text, format: "pdf", page_count: Some(page_count) });
 }
 let bytes = std::fs::read(target).map_err(|e| e.to_string())?;
 if bytes.contains(&0) { return Err("バイナリファイルは比較できません".into()); }
 let text = String::from_utf8(bytes).map_err(|_| "UTF-8のテキストファイルを選択してください".to_string())?;
 Ok(DocumentContent { text, format: "text", page_count: None })
}
#[tauri::command]
fn save_text_atomic(path: String, content: String, expected_content: String) -> Result<(),String> {
 let target=Path::new(&path);let parent=target.parent().ok_or("保存先の親フォルダがありません")?;
 // Refuse to overwrite an external edit or a file removed since opening.
 let original = std::fs::read(target).map_err(|e|format!("保存前に元ファイルを確認できません: {e}"))?;
 if original != expected_content.as_bytes() {
  return Err("他のアプリでファイルが変更されています。上書きせず保存を中止しました".into());
 }
 let mut temp=tempfile::NamedTempFile::new_in(parent).map_err(|e|format!("一時ファイルを作成できません: {e}"))?;
 temp.write_all(content.as_bytes()).map_err(|e|format!("一時ファイルへ書き込めません: {e}"))?;temp.as_file().sync_all().map_err(|e|format!("一時ファイルを同期できません: {e}"))?;
 if target.exists(){let perms=std::fs::metadata(target).map_err(|e|e.to_string())?.permissions();temp.as_file().set_permissions(perms).map_err(|e|e.to_string())?;}
 temp.persist(target).map_err(|e|format!("保存先を置換できません: {}",e.error))?;
 if let Ok(dir)=OpenOptions::new().read(true).open(parent){let _=dir.sync_all();}Ok(())
}
#[cfg_attr(mobile, tauri::mobile_entry_point)]
#[cfg(target_os = "macos")]
fn japanese_menu(app: &tauri::AppHandle) -> tauri::Result<tauri::menu::Menu<tauri::Wry>> {
 use tauri::menu::{Menu, Submenu, PredefinedMenuItem as Item};
 let app_menu = Submenu::with_items(app, "MacMerge", true, &[
  &Item::about(app, Some("MacMergeについて"), None)?,
  &Item::separator(app)?,
  &Item::services(app, Some("サービス"))?,
  &Item::separator(app)?,
  &Item::hide(app, Some("MacMergeを非表示"))?,
  &Item::hide_others(app, Some("ほかを非表示"))?,
  &Item::show_all(app, Some("すべてを表示"))?,
  &Item::separator(app)?,
  &Item::quit(app, Some("MacMergeを終了"))?,
 ])?;
 let file = Submenu::with_items(app, "ファイル", true, &[
  &Item::close_window(app, Some("ウインドウを閉じる"))?,
 ])?;
 let edit = Submenu::with_items(app, "編集", true, &[
  &Item::undo(app, Some("取り消す"))?,
  &Item::redo(app, Some("やり直す"))?,
  &Item::separator(app)?,
  &Item::cut(app, Some("カット"))?,
  &Item::copy(app, Some("コピー"))?,
  &Item::paste(app, Some("ペースト"))?,
  &Item::select_all(app, Some("すべてを選択"))?,
 ])?;
 let view = Submenu::with_items(app, "表示", true, &[
  &Item::fullscreen(app, Some("フルスクリーンにする"))?,
 ])?;
 let window = Submenu::with_id_and_items(app, tauri::menu::WINDOW_SUBMENU_ID, "ウインドウ", true, &[
  &Item::minimize(app, Some("しまう"))?,
  &Item::maximize(app, Some("拡大／縮小"))?,
  &Item::separator(app)?,
  &Item::close_window(app, Some("ウインドウを閉じる"))?,
 ])?;
 let help = Submenu::with_id_and_items(app, tauri::menu::HELP_SUBMENU_ID, "ヘルプ", true, &[])?;
 Menu::with_items(app, &[&app_menu, &file, &edit, &view, &window, &help])
}

pub fn run(){tauri::Builder::default().menu(|app| {
 #[cfg(target_os = "macos")]
 { japanese_menu(app) }
 #[cfg(not(target_os = "macos"))]
 { tauri::menu::Menu::default(app) }
}).plugin(tauri_plugin_dialog::init()).plugin(tauri_plugin_fs::init()).invoke_handler(tauri::generate_handler![compare_text,read_text_document,save_text_atomic]).run(tauri::generate_context!()).expect("error while running tauri application");}

#[cfg(test)]
mod tests {
 use super::*;
 #[test]
 fn safe_save_preserves_crlf_and_rejects_external_edits() {
  let dir = tempfile::tempdir().unwrap();
  let file = dir.path().join("sample.txt");
  std::fs::write(&file, "before\r\n").unwrap();
  let path = file.to_string_lossy().into_owned();
  save_text_atomic(path.clone(), "after\r\n".into(), "before\r\n".into()).unwrap();
  assert_eq!(std::fs::read(&file).unwrap(), b"after\r\n");
  std::fs::write(&file, "external\n").unwrap();
  assert!(save_text_atomic(path, "overwrite".into(), "after\r\n".into()).is_err());
  assert_eq!(std::fs::read(&file).unwrap(), b"external\n");
  assert_eq!(std::fs::read_dir(dir.path()).unwrap().count(), 1);
 }
 #[test]
 fn safe_save_does_not_recreate_removed_files() {
  let dir = tempfile::tempdir().unwrap();
  let file = dir.path().join("missing.txt");
  assert!(save_text_atomic(file.to_string_lossy().into_owned(), "new".into(), "old".into()).is_err());
  assert!(!file.exists());
 }
 #[test]
 fn text_loading_rejects_binary_and_diff_handles_empty_files() {
  let dir = tempfile::tempdir().unwrap();
  let file = dir.path().join("binary.txt");
  std::fs::write(&file, b"a\0b").unwrap();
  assert!(read_text_document(file.to_string_lossy().into_owned()).is_err());
  let result = compare_text(String::new(), "added\n".into());
  assert_eq!(result.hunks.len(), 1);
  assert_eq!(result.rows[0].right, Some(1));
  assert_eq!(result.rows[0].left, None);
 }
 #[test]
 fn pdf_loading_extracts_page_markers_and_rejects_image_only_documents() {
  let sample = Path::new(env!("CARGO_MANIFEST_DIR")).join("../samples/pdf-diff-demo/Invoice-A.pdf");
  let content = read_text_document(sample.to_string_lossy().into_owned()).unwrap();
  assert_eq!(content.format, "pdf");
  assert_eq!(content.page_count, Some(2));
  assert!(content.text.contains("--- ページ 1 ---"));
  assert!(content.text.contains("請求番号"));
  let scanned = Path::new(env!("CARGO_MANIFEST_DIR")).join("../samples/pdf-diff-demo/Scanned-image-only.pdf");
  let error = read_text_document(scanned.to_string_lossy().into_owned()).unwrap_err();
  assert!(error.contains("スキャン画像のみ"));
 }
}

#[cfg(test)]
mod capacity_tests {
 use super::*;
 use std::time::Instant;

 #[test]
 fn five_visible_panes_can_diff_large_texts_against_one_baseline() {
  let baseline = (0..10_000).map(|line| format!("shared line {line:05}\n")).collect::<String>();
  let candidates = (0..4).map(|candidate| {
   let mut lines = baseline.lines().map(str::to_owned).collect::<Vec<_>>();
   for line in (candidate..lines.len()).step_by(997) { lines[line] = format!("candidate {candidate} line {line:05}"); }
   lines.join("\n") + "\n"
  }).collect::<Vec<_>>();
  let start = Instant::now();
  let results = candidates.iter().map(|text| compare_text(baseline.clone(), text.clone())).collect::<Vec<_>>();
  let elapsed = start.elapsed();
  assert_eq!(results.len(), 4);
  assert!(results.iter().all(|result| !result.hunks.is_empty()));
  eprintln!("4 x 10,000-line comparisons: {elapsed:?}");
 }
}
