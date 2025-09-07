<!-- /assets/footer.js -->
<script>
(function() {
  // Detect a sensible base path for fetching the shared footer.
  // If you use a CUSTOM DOMAIN (e.g., yegge.com), '/assets/footer.html' works everywhere.
  // If you use a PROJECT PAGE (e.g., username.github.io/repo), set data-base on the script tag.

  function computeBase() {
    // Try to read a data-base from the current script tag
    const currentScript = document.currentScript;
    if (currentScript && currentScript.dataset.base) return currentScript.dataset.base.replace(/\/$/, '');

    // Default: site root (works with custom domains or user/organization pages)
    return '';
  }

  const base = computeBase();
  const footerURL = `${base}/assets/footer.html`;

  fetch(footerURL, { cache: 'no-cache' })
    .then(resp => {
      if (!resp.ok) throw new Error('Footer fetch failed: ' + resp.status);
      return resp.text();
    })
    .then(html => {
      const tpl = document.createElement('template');
      tpl.innerHTML = html.trim();
      const footerEl = tpl.content.firstElementChild;

      // Stamp the current year
      const y = footerEl.querySelector('[data-year]');
      if (y) y.textContent = new Date().getFullYear();

      // Insert at the very end of <body>
      document.body.appendChild(footerEl);
    })
    .catch(err => {
      // Silent fail to avoid blocking page rendering
      console.warn(err);
    });
})();
</script>