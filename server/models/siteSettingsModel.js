const { query } = require("../db");

const EMPTY_SOCIAL_LINKS = Object.freeze({
  instagram: "",
  facebook: "",
  tiktok: "",
});

async function getSocialLinks() {
  const { rows } = await query(
    "SELECT value FROM site_settings WHERE key = $1",
    ["social_links"]
  );
  return { ...EMPTY_SOCIAL_LINKS, ...(rows[0]?.value || {}) };
}

async function saveSocialLinks(links) {
  const { rows } = await query(
    `INSERT INTO site_settings (key, value, updated_at)
     VALUES ($1, $2::jsonb, NOW())
     ON CONFLICT (key) DO UPDATE
       SET value = EXCLUDED.value, updated_at = NOW()
     RETURNING value`,
    ["social_links", JSON.stringify(links)]
  );
  return { ...EMPTY_SOCIAL_LINKS, ...(rows[0]?.value || {}) };
}

module.exports = { getSocialLinks, saveSocialLinks };
