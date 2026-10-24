use serde::Serialize;
use similar::{ChangeTag, TextDiff};
use std::{fs::{File, OpenOptions}, io::{Read, Write}, panic::{catch_unwind, AssertUnwindSafe}, path::{Path, PathBuf}};
use std::sync::atomic::{AtomicBool, Ordering};
use tauri::{Emitter, Manager};
use calamine::{open_workbook_auto, Reader};
use zip::ZipArchive;
const MAX_DOCUMENT_BYTES: u64 = 20 * 1024 * 1024;
const MAX_FOLDER_BYTES: u64 = 50 * 1024 * 1024;
const MAX_FOLDER_FILES: usize = 2_000;
#[derive(Debug, Serialize)] #[serde(rename_all = "camelCase")] struct DocumentContent { text: String, format: &'static str, page_count: Option<usize>, item_count: Option<usize>, skipped_count: Option<usize> }
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
 if metadata.is_dir() { return read_folder_document(target); }
 if !metadata.is_file() { return Err("通常のファイルまたはフォルダを選択してください".into()); }
 if metadata.len() > MAX_DOCUMENT_BYTES { return Err("ファイルは20MB以下にしてください".into()); }
 read_file_document(target)
}

fn extension(path: &Path) -> String { path.extension().and_then(|s| s.to_str()).unwrap_or("").to_ascii_lowercase() }
fn ensure_document_text_limit(bytes: u64) -> Result<(), String> {
 if bytes > MAX_DOCUMENT_BYTES { return Err("抽出した文書テキストが20MBを超えています".into()); }
 Ok(())
}
fn archive_text(path: &Path, entry: &str) -> Result<String, String> {
 let file = File::open(path).map_err(|e| e.to_string())?;
 let mut archive = ZipArchive::new(file).map_err(|e| format!("Officeファイルを開けませんでした: {e}"))?;
 let mut xml = String::new();
 archive.by_name(entry).map_err(|e| format!("Officeファイルに必要な文書がありません: {e}"))?
  .take(MAX_DOCUMENT_BYTES + 1).read_to_string(&mut xml).map_err(|e| format!("Office文書を読み取れません: {e}"))?;
 if xml.len() as u64 > MAX_DOCUMENT_BYTES { return Err("抽出する文書テキストが20MBを超えています".into()); }
 let doc = roxmltree::Document::parse(&xml).map_err(|e| format!("Office文書のXMLを読み取れません: {e}"))?;
 let paragraphs = doc.descendants().filter(|node| matches!(node.tag_name().name(), "p" | "h"))
  .map(|paragraph| paragraph.descendants().filter(|node| node.is_text()).filter_map(|node| node.text()).collect::<String>())
  .filter(|line| !line.is_empty()).collect::<Vec<_>>();
 Ok(paragraphs.join("\n"))
}

fn extract_spreadsheet(path: &Path) -> Result<(String, usize), String> {
 let mut workbook = open_workbook_auto(path).map_err(|e| format!("表計算ファイルを読み取れません: {e}"))?;
 let sheets = workbook.sheet_names().to_vec();
 if sheets.is_empty() { return Err("シートが見つかりません".into()); }
 let mut output = Vec::new(); let mut output_bytes = 0usize;
 for sheet in &sheets {
  let range = workbook.worksheet_range(sheet).map_err(|e| format!("シート「{sheet}」を読み取れません: {e}"))?;
  let heading = format!("--- シート: {sheet} ---"); output_bytes += heading.len(); output.push(heading);
  for row in range.rows() {
   let line = row.iter().map(ToString::to_string).collect::<Vec<_>>().join("\t"); output_bytes += line.len();
   if output_bytes as u64 > MAX_DOCUMENT_BYTES { return Err("抽出する表計算テキストが20MBを超えています".into()); }
   output.push(line);
  }
 }
 Ok((output.join("\n"), sheets.len()))
}

fn read_file_document(target: &Path) -> Result<DocumentContent, String> {
 if target.extension().and_then(|s| s.to_str()).map(|s| s.eq_ignore_ascii_case("pdf")).unwrap_or(false) {
  let extracted = catch_unwind(AssertUnwindSafe(|| pdf_extract::extract_text_by_pages(target)))
   .map_err(|_| "このPDFの文字形式には対応していません。別のPDF、またはテキスト形式で保存したファイルを選択してください".to_string())?;
  let pages = extracted.map_err(|e| format!("PDFを読み取れませんでした（パスワード保護・破損・未対応形式の可能性があります）: {e}"))?;
  let page_count = pages.len();
  let extracted_bytes = pages.iter().map(|page| page.len() as u64).sum();
  ensure_document_text_limit(extracted_bytes)?;
  let text = pages.iter().enumerate().map(|(index, page)| format!("--- ページ {} ---\n{}", index + 1, page.trim())).collect::<Vec<_>>().join("\n\n");
  if pages.is_empty() || pages.iter().all(|page| page.trim().is_empty()) { return Err("PDFからテキストを抽出できませんでした。スキャン画像のみのPDFは現在比較できません".into()); }
  return Ok(DocumentContent { text, format: "pdf", page_count: Some(page_count), item_count: None, skipped_count: None });
 }
 let kind = extension(target);
 if matches!(kind.as_str(), "docx" | "odt") {
  let entry = if kind == "docx" { "word/document.xml" } else { "content.xml" };
  let text = archive_text(target, entry)?;
  if text.trim().is_empty() { return Err("文書からテキストを抽出できませんでした".into()); }
  return Ok(DocumentContent { text, format: if kind == "docx" { "docx" } else { "odt" }, page_count: None, item_count: None, skipped_count: None });
 }
 if kind == "pptx" {
  let file = File::open(target).map_err(|e| e.to_string())?;
  let mut archive = ZipArchive::new(file).map_err(|e| format!("PowerPointファイルを開けませんでした: {e}"))?;
  let mut slides = Vec::new();
  for index in 0..archive.len() {
   let entry = archive.by_index(index).map_err(|e| format!("PowerPointスライド一覧を読めません: {e}"))?;
   let name = entry.name().map_err(|e| format!("PowerPointスライド名を読めません: {e}"))?.into_owned();
   if name.starts_with("ppt/slides/slide") && name.ends_with(".xml") { slides.push(name); }
  }
  slides.sort_by_key(|name| name.trim_start_matches("ppt/slides/slide").trim_end_matches(".xml").parse::<usize>().unwrap_or(usize::MAX));
  let count = slides.len();
  let mut output = Vec::new();
  let mut output_bytes = 0u64;
  for (index, slide) in slides.iter().enumerate() {
   let section = format!("--- スライド {} ---\n{}", index + 1, archive_text(target, slide)?);
   output_bytes += section.len() as u64 + if output.is_empty() { 0 } else { 2 };
   ensure_document_text_limit(output_bytes)?;
   output.push(section);
  }
  let text = output.join("\n\n");
  if count == 0 || text.trim().is_empty() { return Err("PowerPointからテキストを抽出できませんでした".into()); }
  return Ok(DocumentContent { text, format: "pptx", page_count: None, item_count: Some(count), skipped_count: None });
 }
 if matches!(kind.as_str(), "xlsx" | "xls" | "ods") {
  let (text, sheet_count) = extract_spreadsheet(target)?;
  return Ok(DocumentContent { text, format: "spreadsheet", page_count: None, item_count: Some(sheet_count), skipped_count: None });
 }
 let bytes = std::fs::read(target).map_err(|e| e.to_string())?;
 if bytes.contains(&0) { return Err("バイナリファイルは比較できません".into()); }
 let text = String::from_utf8(bytes).map_err(|_| "UTF-8のテキストファイルを選択してください".to_string())?;
 Ok(DocumentContent { text, format: "text", page_count: None, item_count: None, skipped_count: None })
}

fn collect_folder_files(root: &Path, current: &Path, files: &mut Vec<PathBuf>, skipped: &mut usize, bytes: &mut u64, depth: usize) -> Result<(), String> {
 if depth > 32 { return Err("フォルダ階層が32段を超えています".into()); }
 let mut entries = std::fs::read_dir(current).map_err(|e| format!("フォルダを読み取れません: {e}"))?.filter_map(Result::ok).collect::<Vec<_>>();
 entries.sort_by_key(|entry| entry.file_name());
 for entry in entries {
  let name = entry.file_name(); let name_text = name.to_string_lossy();
  if matches!(name_text.as_ref(), ".git" | "node_modules" | "target" | "dist" | "build" | ".venv" | "venv" | "vendor" | ".DS_Store") { *skipped += 1; continue; }
  let kind = entry.file_type().map_err(|e| e.to_string())?; let path = entry.path();
  if kind.is_symlink() { *skipped += 1; continue; }
  if kind.is_dir() { collect_folder_files(root, &path, files, skipped, bytes, depth + 1)?; continue; }
  if !kind.is_file() { *skipped += 1; continue; }
  let size = entry.metadata().map_err(|e| e.to_string())?.len();
  if size > MAX_DOCUMENT_BYTES { *skipped += 1; continue; }
  let ext = extension(&path);
  if !matches!(ext.as_str(), "pdf" | "docx" | "odt" | "pptx" | "xlsx" | "xls" | "ods") {
   let sample = std::fs::read(&path).map_err(|e| e.to_string())?;
   if sample.contains(&0) || std::str::from_utf8(&sample).is_err() { *skipped += 1; continue; }
  }
  if files.len() >= MAX_FOLDER_FILES { return Err(format!("比較可能なファイルが{MAX_FOLDER_FILES}件を超えています")); }
  *bytes += size;
  if *bytes > MAX_FOLDER_BYTES { return Err("フォルダ内の対象ファイル合計が50MBを超えています".into()); }
  files.push(path.strip_prefix(root).unwrap_or(&path).to_path_buf());
 }
 Ok(())
}

fn read_folder_document(root: &Path) -> Result<DocumentContent, String> {
 let mut files = Vec::new(); let mut skipped = 0; let mut bytes = 0;
 collect_folder_files(root, root, &mut files, &mut skipped, &mut bytes, 0)?;
 files.sort();
 if files.is_empty() { return Err("比較できるテキストや文書ファイルがフォルダ内にありません".into()); }
 let mut sections = Vec::new();
 let mut text_bytes = 0usize;
 for relative in &files {
  let absolute = root.join(relative);
  let document = read_file_document(&absolute).map_err(|e| format!("{}: {e}", relative.display()))?;
  let section = format!("--- ファイル: {} ---\n{}", relative.to_string_lossy().replace('\\', "/"), escape_folder_content(&document.text));
  let separator_bytes = if sections.is_empty() { 0 } else { 2 };
  let projected_bytes = text_bytes + separator_bytes + section.len();
  if projected_bytes as u64 > MAX_FOLDER_BYTES { return Err("フォルダから抽出したテキストが50MBを超えています".into()); }
  text_bytes = projected_bytes;
  sections.push(section);
 }
 let text = sections.join("\n\n");
 if text.len() as u64 > MAX_FOLDER_BYTES { return Err("フォルダから抽出したテキストが50MBを超えています".into()); }
 Ok(DocumentContent { text, format: "folder", page_count: None, item_count: Some(files.len()), skipped_count: Some(skipped) })
}

fn escape_folder_content(text: &str) -> String {
 let mut escaped = String::with_capacity(text.len());
 for line in text.split_inclusive('\n') {
  let content = line.strip_suffix('\n').unwrap_or(line);
  let marker_candidate = content.strip_suffix('\r').unwrap_or(content).trim_start_matches('\\');
  if marker_candidate.starts_with("--- ファイル: ") && marker_candidate.ends_with(" ---") {
   escaped.push('\\');
  }
  escaped.push_str(line);
 }
 escaped
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
struct ExitPermission(AtomicBool);

#[tauri::command]
fn request_app_exit(app: tauri::AppHandle, permission: tauri::State<'_, ExitPermission>) {
 permission.0.store(true, Ordering::SeqCst);
 app.exit(0);
}
#[cfg_attr(mobile, tauri::mobile_entry_point)]
#[cfg(target_os = "macos")]
fn japanese_menu(app: &tauri::AppHandle) -> tauri::Result<tauri::menu::Menu<tauri::Wry>> {
 use tauri::menu::{Menu, MenuItem, Submenu, PredefinedMenuItem as Item};
 let quit = MenuItem::with_id(app, "macmerge-quit", "MacMergeを終了", true, Some("CmdOrCtrl+Q"))?;
 let app_menu = Submenu::with_items(app, "MacMerge", true, &[
  &Item::about(app, Some("MacMergeについて"), None)?,
  &Item::separator(app)?,
  &Item::services(app, Some("サービス"))?,
  &Item::separator(app)?,
  &Item::hide(app, Some("MacMergeを非表示"))?,
  &Item::hide_others(app, Some("ほかを非表示"))?,
  &Item::show_all(app, Some("すべてを表示"))?,
  &Item::separator(app)?,
  &quit,
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

pub fn run(){tauri::Builder::default().manage(ExitPermission(AtomicBool::new(false))).menu(|app| {
 #[cfg(target_os = "macos")]
 { japanese_menu(app) }
 #[cfg(not(target_os = "macos"))]
 { tauri::menu::Menu::default(app) }
}).on_menu_event(|app, event| {
 if event.id() == "macmerge-quit" {
  let _ = app.emit("macmerge-exit-requested", ());
 }
}).plugin(tauri_plugin_dialog::init()).plugin(tauri_plugin_fs::init()).invoke_handler(tauri::generate_handler![compare_text,read_text_document,save_text_atomic,request_app_exit]).build(tauri::generate_context!()).expect("error while building tauri application").run(|app, event| {
 if let tauri::RunEvent::ExitRequested { api, .. } = event {
  if !app.state::<ExitPermission>().0.swap(false, Ordering::SeqCst) {
   api.prevent_exit();
   let _ = app.emit("macmerge-exit-requested", ());
  }
 }
});}

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
 #[test]
 fn folder_comparison_keeps_relative_paths_and_skips_binary_files() {
  let dir = tempfile::tempdir().unwrap();
  let folder = dir.path().join("Folder-A"); std::fs::create_dir_all(folder.join("src")).unwrap();
  std::fs::write(folder.join("README.md"), "version one\n--- ファイル: fake.txt ---\nordinary content\n\\--- ファイル: literal.txt ---\n").unwrap();
  std::fs::write(folder.join("src/config.json"), "{\"mode\":\"test\"}\n").unwrap();
  std::fs::write(folder.join("image.png"), b"\x89PNG\0binary").unwrap();
  let content = read_text_document(folder.to_string_lossy().into_owned()).unwrap();
  assert_eq!(content.format, "folder");
  assert_eq!(content.item_count, Some(2));
  assert_eq!(content.skipped_count, Some(1));
  assert!(content.text.contains("--- ファイル: src/config.json ---"));
  assert!(content.text.contains("version one"));
  assert!(content.text.contains("\\--- ファイル: fake.txt ---\nordinary content"));
  assert!(content.text.contains("\\\\--- ファイル: literal.txt ---"));
  let peer = dir.path().join("Folder-B"); std::fs::create_dir_all(peer.join("src")).unwrap();
  std::fs::write(peer.join("README.md"), "version two\n").unwrap();
  std::fs::write(peer.join("src/new.json"), "{}\n").unwrap();
  let peer_content = read_text_document(peer.to_string_lossy().into_owned()).unwrap();
  let diff = compare_text(content.text, peer_content.text);
  assert!(diff.hunks.len() >= 2, "folder changes should identify edited and added paths");
 }
 #[test]
 fn folder_marker_escaping_preserves_line_endings_and_literal_backslashes() {
  let input = "before\r\n--- ファイル: child.txt ---\r\n\\--- ファイル: literal.txt ---\r\n";
  assert_eq!(escape_folder_content(input), "before\r\n\\--- ファイル: child.txt ---\r\n\\\\--- ファイル: literal.txt ---\r\n");
 }
 #[test]
 fn extracted_document_text_limit_accepts_exact_limit_and_rejects_overflow() {
  assert!(ensure_document_text_limit(MAX_DOCUMENT_BYTES).is_ok());
  assert!(ensure_document_text_limit(MAX_DOCUMENT_BYTES + 1).is_err());
 }
 #[test]
 fn folder_file_count_limit_accepts_2000_and_rejects_2001() {
  for (count, should_succeed) in [(MAX_FOLDER_FILES, true), (MAX_FOLDER_FILES + 1, false)] {
   let dir = tempfile::tempdir().unwrap();
   for index in 0..count {
    std::fs::write(dir.path().join(format!("{index:04}.docx")), []).unwrap();
   }
   let mut files = Vec::new(); let mut skipped = 0; let mut bytes = 0;
   let result = collect_folder_files(dir.path(), dir.path(), &mut files, &mut skipped, &mut bytes, 0);
   assert_eq!(result.is_ok(), should_succeed, "{count} files");
   if should_succeed { assert_eq!(files.len(), MAX_FOLDER_FILES); }
  }
 }
 #[test]
 fn folder_size_limit_accepts_50_mib_and_rejects_one_byte_over() {
  for (extra, should_succeed) in [(0, true), (1, false)] {
   let dir = tempfile::tempdir().unwrap();
   for (name, size) in [("a.docx", MAX_DOCUMENT_BYTES), ("b.docx", MAX_DOCUMENT_BYTES), ("c.docx", 10 * 1024 * 1024 + extra)] {
    let file = File::create(dir.path().join(name)).unwrap();
    file.set_len(size).unwrap();
   }
   let mut files = Vec::new(); let mut skipped = 0; let mut bytes = 0;
   let result = collect_folder_files(dir.path(), dir.path(), &mut files, &mut skipped, &mut bytes, 0);
   assert_eq!(result.is_ok(), should_succeed, "extra bytes: {extra}");
   if should_succeed { assert_eq!(bytes, MAX_FOLDER_BYTES); }
  }
 }
 #[test]
 fn folder_depth_limit_accepts_32_and_rejects_33() {
  for (depth, should_succeed) in [(32, true), (33, false)] {
   let dir = tempfile::tempdir().unwrap();
   let nested = (0..depth).fold(dir.path().to_path_buf(), |path, _| path.join("d"));
   std::fs::create_dir_all(&nested).unwrap();
   std::fs::write(nested.join("leaf.docx"), []).unwrap();
   let mut files = Vec::new(); let mut skipped = 0; let mut bytes = 0;
   let result = collect_folder_files(dir.path(), dir.path(), &mut files, &mut skipped, &mut bytes, 0);
   assert_eq!(result.is_ok(), should_succeed, "depth: {depth}");
  }
 }
 #[test]
 fn office_formats_extract_readable_content() {
  let root = Path::new(env!("CARGO_MANIFEST_DIR")).join("../samples/office-diff-demo");
  for (file, format, expected, item_count) in [
   ("Word-A.docx", "docx", "業務委託契約書", None),
   ("Spreadsheet-A.xlsx", "spreadsheet", "新規顧客管理", Some(1)),
   ("Slides-A.pptx", "pptx", "1.2", Some(1)),
  ] {
   let content = read_text_document(root.join(file).to_string_lossy().into_owned()).unwrap();
   assert_eq!(content.format, format, "{file}");
   assert!(content.text.contains(expected), "{file}: {}", content.text);
   assert_eq!(content.item_count, item_count, "{file}");
  }
 }
 #[test]
 fn powerpoint_rejects_total_extracted_text_over_20_mib() {
  let dir = tempfile::tempdir().unwrap();
  let path = dir.path().join("expanded.pptx");
  let mut archive = zip::ZipWriter::new(File::create(&path).unwrap());
  let options = zip::write::SimpleFileOptions::default();
  let paragraph = "x".repeat(11 * 1024 * 1024);
  for slide in 1..=2 {
   archive.start_file(format!("ppt/slides/slide{slide}.xml"), options).unwrap();
   archive.write_all(format!("<p>{paragraph}</p>").as_bytes()).unwrap();
  }
  archive.finish().unwrap();
  let error = read_text_document(path.to_string_lossy().into_owned()).unwrap_err();
  assert!(error.contains("20MB"), "{error}");
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
