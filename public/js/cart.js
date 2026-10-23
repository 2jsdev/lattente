(function () {
  const CART_KEY = "lattente-cart";

  function readCart() {
    try {
      return JSON.parse(localStorage.getItem(CART_KEY)) || [];
    } catch {
      return [];
    }
  }

  function writeCart(items) {
    localStorage.setItem(CART_KEY, JSON.stringify(items));
    window.dispatchEvent(new CustomEvent("lattente:cart", { detail: items }));
  }

  function addToCart(product, qty = 1) {
    const items = readCart();
    const existing = items.find((item) => item.id === product.id);

    if (existing) {
      existing.quantity += qty;
    } else {
      items.push({
        id: product.id,
        name: product.name,
        price: Number(product.price),
        currency: product.currency || "Bs.",
        image_url: product.image_url || "",
        quantity: qty,
      });
    }

    writeCart(items);
    return items;
  }

  function removeFromCart(productId) {
    writeCart(readCart().filter((item) => item.id !== productId));
  }

  function setCartQuantity(productId, quantity) {
    const qty = Math.max(0, Number(quantity) || 0);
    if (qty <= 0) {
      removeFromCart(productId);
      return readCart();
    }
    const items = readCart();
    const existing = items.find((item) => item.id === productId);
    if (existing) {
      existing.quantity = qty;
      writeCart(items);
      return items;
    }
    return items;
  }

  function clearCart() {
    writeCart([]);
  }

  function cartCount(items = readCart()) {
    return items.reduce((sum, item) => sum + item.quantity, 0);
  }

  function cartTotal(items = readCart()) {
    return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  }

  function formatPrice(value, currency = "Bs.") {
    const amount = Number(value).toFixed(2).replace(".", ",");
    return `${amount} ${currency}`;
  }

  window.LattenteCart = {
    readCart,
    writeCart,
    addToCart,
    removeFromCart,
    setCartQuantity,
    clearCart,
    cartCount,
    cartTotal,
    formatPrice,
  };
})();
