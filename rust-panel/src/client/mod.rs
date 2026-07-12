use anyhow::Result;

pub struct DbClient {
    base_url: String,
}

impl DbClient {
    pub fn new(base_url: &str) -> Self {
        Self {
            base_url: base_url.to_string(),
        }
    }

    pub fn check_health(&self) -> Result<bool> {
        let resp = ureq::get(&format!("{}/api/health", self.base_url))
            .call()?;
        Ok(resp.status() == 200)
    }
}
