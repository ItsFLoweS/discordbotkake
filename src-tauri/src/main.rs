#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
use std::{io::{BufRead, BufReader, Write}, process::{Child, ChildStdin, ChildStdout, Command, Stdio}, sync::Mutex};
use tauri::Manager;
use serde_json::{json, Value};

struct Bridge { child: Child, input: ChildStdin, output: BufReader<ChildStdout> }
impl Bridge {
    fn call(&mut self, op: &str, payload: Value) -> Result<Value, String> {
        let request = json!({"op": op, "payload": payload});
        writeln!(self.input, "{}", request).map_err(|e| e.to_string())?;
        self.input.flush().map_err(|e| e.to_string())?;
        let mut line = String::new();
        self.output.read_line(&mut line).map_err(|e| e.to_string())?;
        let response: Value = serde_json::from_str(&line).map_err(|_| "Движок DBK завершился или вернул некорректный ответ".to_string())?;
        if let Some(error) = response.get("error") { return Err(error.as_str().unwrap_or("Ошибка движка").to_string()); }
        Ok(response["result"].clone())
    }
}
impl Drop for Bridge { fn drop(&mut self) { let _ = self.child.kill(); let _ = self.child.wait(); } }
struct State(Mutex<Bridge>);

#[tauri::command]
async fn bridge(app: tauri::AppHandle, op: String, mut payload: Value) -> Result<Value, String> {
    tauri::async_runtime::spawn_blocking(move || {
        if op == "bot.start" {
            let id = payload["id"].as_str().ok_or("Нет ID проекта")?;
            let entry = keyring::Entry::new("DBK", id).map_err(|e| e.to_string())?;
            payload["token"] = json!(entry.get_password().map_err(|_| "Сначала сохраните токен бота в настройках")?);
        }
        app.state::<State>().0.lock().map_err(|e| e.to_string())?.call(&op, payload)
    }).await.map_err(|e| e.to_string())?
}
#[tauri::command]
fn save_secret(id: String, token: String) -> Result<(), String> {
    let entry = keyring::Entry::new("DBK", &id).map_err(|e| e.to_string())?;
    if token.trim().is_empty() { entry.delete_credential().map_err(|e| e.to_string()) } else { entry.set_password(token.trim()).map_err(|e| e.to_string()) }
}
#[tauri::command]
async fn export_file(content: String, name: String) -> Result<bool, String> {
    tauri::async_runtime::spawn_blocking(move || {
        if let Some(path) = rfd::FileDialog::new().add_filter("DBK project", &["dbk"]).set_file_name(&name).save_file() {
            std::fs::write(path, content).map_err(|e| e.to_string())?; return Ok(true)
        } Ok(false)
    }).await.map_err(|e| e.to_string())?
}
#[tauri::command]
async fn import_file() -> Result<Option<String>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        if let Some(path) = rfd::FileDialog::new().add_filter("DBK project", &["dbk"]).pick_file() {
            let size = std::fs::metadata(&path).map_err(|e| e.to_string())?.len();
            if size > 10_000_000 { return Err("Проект больше 10 МБ".into()); }
            return std::fs::read_to_string(path).map(Some).map_err(|e| e.to_string())
        } Ok(None)
    }).await.map_err(|e| e.to_string())?
}
fn main() {
    tauri::Builder::default().setup(|app| {
        let data = app.path().app_data_dir()?; std::fs::create_dir_all(&data)?;
        let resources = app.path().resource_dir()?;
        let root = if cfg!(debug_assertions) { std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("..") } else { resources.join("resources") };
        let node = if cfg!(debug_assertions) { std::path::PathBuf::from("node") } else { root.join("node.exe") };
        let mut cmd = Command::new(node);
        cmd.arg(root.join("runtime/server.mjs")).env("DBK_DATA", &data).stdin(Stdio::piped()).stdout(Stdio::piped()).stderr(Stdio::null());
        #[cfg(windows)] { use std::os::windows::process::CommandExt; cmd.creation_flags(0x08000000); }
        let mut child = cmd.spawn()?;
        let input = child.stdin.take().ok_or("stdin unavailable")?;
        let output = BufReader::new(child.stdout.take().ok_or("stdout unavailable")?);
        app.manage(State(Mutex::new(Bridge { child, input, output })));
        Ok(())
    }).invoke_handler(tauri::generate_handler![bridge, save_secret, export_file, import_file]).run(tauri::generate_context!()).expect("Не удалось запустить DBK");
}
