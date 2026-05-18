use std::sync::Mutex;
use tauri::{
    menu::{Menu, MenuItem},
    tray::{TrayIconBuilder, TrayIconId},
    Emitter, Manager,
};

const DEFAULT_MAIN_SHORTCUT: &str = "CmdOrCtrl+Shift+N";
const DEFAULT_CAPTURE_SHORTCUT: &str = "CmdOrCtrl+Shift+Space";

struct ShortcutConfig {
    main: String,
    capture: String,
}

// Scale factor of the monitor the main window was last shown on.
// Used to correctly convert outer_size() (physical) → logical when
// the compositor hasn't yet updated for the new monitor.
// ── helpers ──────────────────────────────────────────────────────────────────

/// cursor_position() returns logical coords (NSEvent.mouseLocation).
/// monitor.position()/size() are physical. Convert to logical for comparison.
fn monitor_contains_logical(m: &tauri::Monitor, lx: f64, ly: f64) -> bool {
    let p = m.position();
    let s = m.size();
    let sf = m.scale_factor();
    let mx = p.x as f64 / sf;
    let my = p.y as f64 / sf;
    let mw = s.width as f64 / sf;
    let mh = s.height as f64 / sf;
    lx >= mx && lx < mx + mw && ly >= my && ly < my + mh
}

/// Find monitor under cursor, falling back to the closest one if none matches
/// (handles mobile/USB monitors whose coords may not be enumerated precisely).
fn monitor_for_cursor(
    monitors: &[tauri::Monitor],
    cx: f64,
    cy: f64,
) -> Option<&tauri::Monitor> {
    monitors
        .iter()
        .find(|m| monitor_contains_logical(m, cx, cy))
        .or_else(|| {
            monitors.iter().min_by_key(|m| {
                let p = m.position();
                let s = m.size();
                let sf = m.scale_factor();
                let center_x = p.x as f64 / sf + s.width as f64 / sf / 2.0;
                let center_y = p.y as f64 / sf + s.height as f64 / sf / 2.0;
                let dx = cx - center_x;
                let dy = cy - center_y;
                (dx * dx + dy * dy) as i64
            })
        })
}

/// outer_position() works for hidden windows (physical coords).
/// Use it to find which monitor the window is currently on and return its scale.
/// Falls back to primary monitor or 1.0 if position is unavailable.
fn window_current_scale(window: &tauri::WebviewWindow) -> f64 {
    let monitors = window.available_monitors().unwrap_or_default();
    if let Ok(pos) = window.outer_position() {
        // Find monitor whose physical rect contains the window's top-left corner.
        let found = monitors.iter().find(|m| {
            let mp = m.position();
            let ms = m.size();
            pos.x >= mp.x
                && pos.x < mp.x + ms.width as i32
                && pos.y >= mp.y
                && pos.y < mp.y + ms.height as i32
        });
        if let Some(m) = found {
            return m.scale_factor();
        }
        // Fallback: closest monitor by Manhattan distance to its origin.
        if let Some(m) = monitors.iter().min_by_key(|m| {
            let mp = m.position();
            (pos.x - mp.x).abs() + (pos.y - mp.y).abs()
        }) {
            return m.scale_factor();
        }
    }
    // Window never positioned — use primary monitor.
    window
        .primary_monitor()
        .ok()
        .flatten()
        .map(|m| m.scale_factor())
        .unwrap_or(1.0)
}

fn center_and_show(window: &tauri::WebviewWindow) {
    let cur_scale = window_current_scale(window);
    let win_phys = window
        .outer_size()
        .unwrap_or(tauri::PhysicalSize { width: 640, height: 480 });

    let _ = window.show();

    if let Ok(cursor_pos) = window.cursor_position() {
        let monitors = window.available_monitors().unwrap_or_default();

        if let Some(m) = monitor_for_cursor(&monitors, cursor_pos.x, cursor_pos.y) {
            let tpos = m.position();
            let tsize = m.size();
            let tscale = m.scale_factor();

            // Window size in logical points (independent of which monitor it's on).
            let win_lw = win_phys.width as f64 / cur_scale;
            let win_lh = win_phys.height as f64 / cur_scale;

            // monitor.position() is in physical pixels; monitor.size() is also physical.
            // Convert both to logical points by dividing by the monitor's scale factor.
            let mon_lx = tpos.x as f64 / tscale;
            let mon_ly = tpos.y as f64 / tscale;
            let mon_lw = tsize.width as f64 / tscale;
            let mon_lh = tsize.height as f64 / tscale;

            // Compute in logical points and pass as LogicalPosition so Tauri does NOT
            // re-divide by the window's (stale) scale_factor(). If we passed
            // PhysicalPosition, Tauri would divide by window.scale_factor() which is
            // still the OLD monitor's scale right after show(), giving wrong coords.
            let cx = mon_lx + (mon_lw - win_lw) / 2.0;
            let cy = mon_ly + (mon_lh - win_lh) / 2.0;

            let _ = window.set_position(tauri::LogicalPosition::new(cx, cy));
        }
    }

    let _ = window.set_focus();
}

fn toggle_window(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        if window.is_visible().unwrap_or(false) {
            let _ = window.hide();
        } else {
            center_and_show(&window);
        }
    }
}

fn show_at_cursor(window: &tauri::WebviewWindow) {
    if let Ok(cursor) = window.cursor_position() {
        let win_size = window
            .outer_size()
            .unwrap_or(tauri::PhysicalSize { width: 600, height: 200 });
        let monitors = window.available_monitors().unwrap_or_default();

        let (mut x, mut y) = (cursor.x as i32, cursor.y as i32);

        if let Some(m) = monitor_for_cursor(&monitors, cursor.x, cursor.y) {
            let mp = m.position();
            let ms = m.size();
            let right_limit = mp.x + ms.width as i32 - win_size.width as i32;
            let bottom_limit = mp.y + ms.height as i32 - win_size.height as i32;
            x = x.min(right_limit).max(mp.x);
            y = y.min(bottom_limit).max(mp.y);
        }

        let _ = window.set_position(tauri::PhysicalPosition::new(x, y));
    }
    let _ = window.show();
    let _ = window.set_focus();
}

fn toggle_capture_window(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("capture") {
        if window.is_visible().unwrap_or(false) {
            let _ = window.hide();
        } else {
            show_at_cursor(&window);
        }
    }
}

// ── commands ──────────────────────────────────────────────────────────────────

#[tauri::command]
fn update_tray_badge(app: tauri::AppHandle, count: u32, overdue_tooltip: Option<String>) {
    let tray_id = TrayIconId::new("main-tray");
    if let Some(tray) = app.tray_by_id(&tray_id) {
        let title = if count > 0 { Some(count.to_string()) } else { None };
        let _ = tray.set_title(title.as_deref());
        let tooltip = if count > 0 {
            overdue_tooltip.unwrap_or_else(|| format!("Flote – {}件の期限切れタスク", count))
        } else {
            "Flote".to_string()
        };
        let _ = tray.set_tooltip(Some(&tooltip));
    }
}

#[tauri::command]
fn update_tray_menu(app: tauri::AppHandle, open_label: String, quit_label: String) -> Result<(), String> {
    let open_i = MenuItem::with_id(&app, "open", &open_label, true, None::<&str>)
        .map_err(|e| e.to_string())?;
    let quit_i = MenuItem::with_id(&app, "quit", &quit_label, true, None::<&str>)
        .map_err(|e| e.to_string())?;
    let menu = Menu::with_items(&app, &[&open_i, &quit_i])
        .map_err(|e| e.to_string())?;
    let tray_id = TrayIconId::new("main-tray");
    if let Some(tray) = app.tray_by_id(&tray_id) {
        tray.set_menu(Some(menu)).map_err(|e| e.to_string())?;
    }
    Ok(())
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
fn open_path(path: String) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    std::process::Command::new("open")
        .arg("-R")
        .arg(&path)
        .spawn()
        .map_err(|e| e.to_string())?;
    #[cfg(target_os = "windows")]
    std::process::Command::new("explorer")
        .arg(&path)
        .spawn()
        .map_err(|e| e.to_string())?;
    #[cfg(target_os = "linux")]
    std::process::Command::new("xdg-open")
        .arg(&path)
        .spawn()
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn set_dock_visible(app: tauri::AppHandle, visible: bool) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        use tauri::ActivationPolicy;
        let _ = app.set_activation_policy(if visible {
            ActivationPolicy::Regular
        } else {
            ActivationPolicy::Accessory
        });
    }
    let _ = (app, visible);
    Ok(())
}

#[tauri::command]
fn update_global_shortcut(app: tauri::AppHandle, shortcut: String) -> Result<(), String> {
    use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutState};

    let main_sc: tauri_plugin_global_shortcut::Shortcut =
        shortcut.parse().map_err(|e| format!("{e:?}"))?;

    let capture_sc_str = {
        let state = app.state::<Mutex<ShortcutConfig>>();
        let mut cfg = state.lock().unwrap();
        cfg.main = shortcut.clone();
        cfg.capture.clone()
    };

    let manager = app.global_shortcut();
    manager.unregister_all().map_err(|e| e.to_string())?;

    manager
        .on_shortcut(main_sc, |app_handle, _sc, event| {
            if event.state == ShortcutState::Pressed {
                toggle_window(app_handle);
            }
        })
        .map_err(|e| e.to_string())?;

    if shortcut.to_lowercase() != capture_sc_str.to_lowercase() {
        if let Ok(capture_sc) =
            capture_sc_str.parse::<tauri_plugin_global_shortcut::Shortcut>()
        {
            let _ = manager.on_shortcut(capture_sc, |app_handle, _sc, event| {
                if event.state == ShortcutState::Pressed {
                    toggle_capture_window(app_handle);
                }
            });
        }
    }

    Ok(())
}

#[tauri::command]
fn update_capture_shortcut(app: tauri::AppHandle, shortcut: String) -> Result<(), String> {
    use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutState};

    let capture_sc: tauri_plugin_global_shortcut::Shortcut =
        shortcut.parse().map_err(|e| format!("{e:?}"))?;

    let main_sc_str = {
        let state = app.state::<Mutex<ShortcutConfig>>();
        let mut cfg = state.lock().unwrap();
        cfg.capture = shortcut.clone();
        cfg.main.clone()
    };

    let manager = app.global_shortcut();
    manager.unregister_all().map_err(|e| e.to_string())?;

    if let Ok(main_sc) = main_sc_str.parse::<tauri_plugin_global_shortcut::Shortcut>() {
        let _ = manager.on_shortcut(main_sc, |app_handle, _sc, event| {
            if event.state == ShortcutState::Pressed {
                toggle_window(app_handle);
            }
        });
    }

    if shortcut.to_lowercase() != main_sc_str.to_lowercase() {
        let _ = manager.on_shortcut(capture_sc, |app_handle, _sc, event| {
            if event.state == ShortcutState::Pressed {
                toggle_capture_window(app_handle);
            }
        });
    }

    Ok(())
}

/// Called from the capture window to hide itself.
#[tauri::command]
fn hide_capture_window(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("capture") {
        window.hide().map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// Called from the capture window to forward the saved text to the main window.
#[derive(serde::Serialize, Clone)]
struct QuickNotePayload {
    text: String,
}

#[tauri::command]
fn relay_quick_note(app: tauri::AppHandle, text: String) -> Result<(), String> {
    if let Some(main) = app.get_webview_window("main") {
        main.emit("quick-note", QuickNotePayload { text })
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

// ── entry point ───────────────────────────────────────────────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_autostart::init(
            #[cfg(target_os = "macos")]
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            #[cfg(not(target_os = "macos"))]
            tauri_plugin_autostart::WindowsLauncher::CurrentUserRun,
            None,
        ))
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .manage(Mutex::new(ShortcutConfig {
            main: DEFAULT_MAIN_SHORTCUT.to_string(),
            capture: DEFAULT_CAPTURE_SHORTCUT.to_string(),
        }))
        .invoke_handler(tauri::generate_handler![
            update_tray_badge,
            update_tray_menu,
            set_always_on_top,
            set_dock_visible,
            update_global_shortcut,
            update_capture_shortcut,
            open_path,
            hide_capture_window,
            relay_quick_note,
        ])
        .setup(|app| {
            // ── tray menu ──────────────────────────────────────────────────
            let open_i = MenuItem::with_id(app, "open", "開く", true, None::<&str>)?;
            let quit_i = MenuItem::with_id(app, "quit", "終了", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&open_i, &quit_i])?;

            TrayIconBuilder::with_id("main-tray")
                .icon(tauri::include_image!("icons/tray.png"))
                .icon_as_template(cfg!(target_os = "macos"))
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "open" => toggle_window(app),
                    "quit" => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let tauri::tray::TrayIconEvent::Click {
                        button: tauri::tray::MouseButton::Left,
                        button_state: tauri::tray::MouseButtonState::Up,
                        ..
                    } = event
                    {
                        toggle_window(tray.app_handle());
                    }
                })
                .build(app)?;

            // ── remove OS window border/shadow from main window ───────────
            if let Some(main) = app.get_webview_window("main") {
                let _ = main.set_shadow(false);
            }

            // ── quick capture window ───────────────────────────────────────
            tauri::WebviewWindowBuilder::new(
                app,
                "capture",
                tauri::WebviewUrl::App("index.html?capture=1".into()),
            )
            .title("")
            .inner_size(580.0, 168.0)
            .decorations(false)
            .transparent(true)
            .always_on_top(true)
            .skip_taskbar(true)
            .resizable(false)
            .visible(false)
            .shadow(false)
            .build()?;

            // ── register global shortcuts ──────────────────────────────────
            use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutState};
            let gs = app.global_shortcut();
            gs.on_shortcut(
                DEFAULT_MAIN_SHORTCUT
                    .parse::<tauri_plugin_global_shortcut::Shortcut>()
                    .expect("invalid main shortcut"),
                |app_handle, _sc, event| {
                    if event.state == ShortcutState::Pressed {
                        toggle_window(app_handle);
                    }
                },
            )
            .expect("failed to register main shortcut");
            gs.on_shortcut(
                DEFAULT_CAPTURE_SHORTCUT
                    .parse::<tauri_plugin_global_shortcut::Shortcut>()
                    .expect("invalid capture shortcut"),
                |app_handle, _sc, event| {
                    if event.state == ShortcutState::Pressed {
                        toggle_capture_window(app_handle);
                    }
                },
            )
            .expect("failed to register capture shortcut");

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
