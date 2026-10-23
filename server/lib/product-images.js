function parseImages(input, fallbackUrl) {
  let images = [];

  if (Array.isArray(input)) {
    images = input;
  } else if (typeof input === "string") {
    const trimmed = input.trim();
    if (trimmed.startsWith("[")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) images = parsed;
      } catch {
        images = trimmed.split(/\n+/);
      }
    } else if (trimmed) {
      images = trimmed.split(/\n+/);
    }
  }

  images = images.map((s) => String(s).trim()).filter(Boolean);

  if (!images.length && fallbackUrl) {
    images = [String(fallbackUrl).trim()].filter(Boolean);
  }

  return [...new Set(images)];
}

function withProductImages(row) {
  if (!row) return row;
  const images = parseImages(row.images, row.image_url);
  return {
    ...row,
    images,
    image_url: images[0] || row.image_url || null,
  };
}

module.exports = { parseImages, withProductImages };
