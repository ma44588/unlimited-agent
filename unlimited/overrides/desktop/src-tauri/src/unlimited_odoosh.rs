//! Unlimited Agent: sign in to Odoo.sh inside the app and hand the session to the workspace server.
//!
//! The person signs in on the real odoo.sh page (their password and 2FA go only to Odoo). The window has no
//! app capability (no IPC), and once odoo.sh shows the signed-in project list we read its `session_id`
//! cookie, close the window and return it to the Connections screen, which sends it to the server.

use std::time::{Duration, Instant};

use tauri::{AppHandle, Manager, Url, WebviewUrl, WebviewWindowBuilder};

const LABEL: &str = "unlimited-odoosh-signin";
const LOGIN: &str = "https://www.odoo.sh/web/login?redirect=%2Fproject";
const TIMEOUT: Duration = Duration::from_secs(600);

fn signed_in(url: &Url) -> bool {
    url.host_str() == Some("www.odoo.sh") && url.path().starts_with("/project")
}

#[tauri::command]
pub async fn unlimited_odoosh_signin(app: AppHandle) -> Result<String, String> {
    if let Some(old) = app.get_webview_window(LABEL) {
        let _ = old.close();
        tokio::time::sleep(Duration::from_millis(300)).await;
    }
    let start = Url::parse(LOGIN).map_err(|e| e.to_string())?;
    let window = WebviewWindowBuilder::new(&app, LABEL, WebviewUrl::External(start))
        .title("Sign in to Odoo.sh")
        .inner_size(520.0, 720.0)
        .center()
        .focused(true)
        .build()
        .map_err(|e| format!("could not open the Odoo.sh window: {e}"))?;

    let began = Instant::now();
    let mut seen = 0u8;
    loop {
        tokio::time::sleep(Duration::from_millis(1200)).await;
        if began.elapsed() > TIMEOUT {
            let _ = window.close();
            return Err("Odoo.sh sign-in timed out; try again".into());
        }
        let Some(w) = app.get_webview_window(LABEL) else {
            return Err("Odoo.sh sign-in was closed before it finished".into());
        };
        let Ok(url) = w.url() else { continue };
        if !signed_in(&url) {
            seen = 0;
            continue;
        }
        // The signed-in page twice in a row, not a redirect on the way to the login page.
        seen += 1;
        if seen < 2 {
            continue;
        }
        let base = Url::parse("https://www.odoo.sh/").map_err(|e| e.to_string())?;
        let cookies = w.cookies_for_url(base).map_err(|e| format!("could not read the Odoo.sh session: {e}"))?;
        if let Some(c) = cookies.iter().find(|c| c.name() == "session_id" && !c.value().is_empty()) {
            let value = c.value().to_string();
            let _ = w.close();
            return Ok(value);
        }
    }
}
