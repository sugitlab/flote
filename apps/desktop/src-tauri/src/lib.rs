use tauri::{
    menu::{Menu, MenuItem},
    tray::{TrayIconBuilder, TrayIconId},
    Manager,
};

fn toggle_window(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        if window.is_visible().unwrap_or(false) {
            let _ = window.hide();
        } else {
            let _ = window.show();
            let _ = window.set_focus();
        }
    }
}

#[tauri::command]
fn update_tray_badge(app: tauri::AppHandle, count: u32) {
    let tray_id = TrayIconId::new("main-tray");
    if let Some(tray) = app.tray_by_id(&tray_id) {
        let title = if count > 0 {
            Some(count.to_string())
        } else {
            None
        };
        let _ = tray.set_title(title.as_deref());
        let tooltip = if count > 0 {
            format!("Flote – {}件の期限切れタスク", count)
        } else {
            "Flote".to_string()
        };
        let _ = tray.set_tooltip(Some(&tooltip));
    }
}

#[tauri::command]
fn set_always_on_top(app: tauri::AppHandle, value: bool) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        window
            .set_always_on_top(value)
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn update_global_shortcut(app: tauri::AppHandle, shortcut: String) -> Result<(), String> {
    use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutState};

    let manager = app.global_shortcut();
    manager.unregister_all().map_err(|e| e.to_string())?;

    manager
        .on_shortcut(shortcut, |app_handle, _shortcut, event| {
            if event.state == ShortcutState::Pressed {
                toggle_window(app_handle);
            }
        })
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_shortcut("CmdOrCtrl+Shift+N")
                .expect("failed to register shortcut")
                .with_handler(|app, _shortcut, event| {
                    if event.state == tauri_plugin_global_shortcut::ShortcutState::Pressed {
                        toggle_window(app);
                    }
                })
                .build(),
        )
        .invoke_handler(tauri::generate_handler![
            update_tray_badge,
            set_always_on_top,
            update_global_shortcut
        ])
        .setup(|app| {
            let open_i = MenuItem::with_id(app, "open", "開く", true, None::<&str>)?;
            let quit_i = MenuItem::with_id(app, "quit", "終了", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&open_i, &quit_i])?;

            TrayIconBuilder::with_id("main-tray")
                .icon(app.default_window_icon().unwrap().clone())
                .icon_as_template(true)
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "open" => toggle_window(app),
                    "quit" => {
                        app.exit(0);
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let tauri::tray::TrayIconEvent::Click { .. } = event {
                        toggle_window(tray.app_handle());
                    }
                })
                .build(app)?;

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
