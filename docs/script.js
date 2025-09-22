 (cd "$(git rev-parse --show-toplevel)" && git apply --3way <<'EOF' 
diff --git a//dev/null b/docs/frontend-preview/script.js
index 0000000000000000000000000000000000000000..dc7fc250f37a05d6e009007ab6ea516034320e51 100644
--- a//dev/null
+++ b/docs/frontend-preview/script.js
@@ -0,0 +1,53 @@
+const navButtons = document.querySelectorAll('.nav-btn');
+const screens = document.querySelectorAll('.screen');
+const licenseBadges = document.querySelectorAll('.badge.license');
+const statusBadge = document.querySelector('.professional-card .badge.status');
+const licenseButtons = document.querySelectorAll('.state-toggle button');
+
+function setActiveScreen(screenId) {
+  screens.forEach((screen) => {
+    if (screen.id === screenId) {
+      screen.setAttribute('data-active', '');
+    } else {
+      screen.removeAttribute('data-active');
+    }
+  });
+
+  navButtons.forEach((btn) => {
+    btn.classList.toggle('active', btn.dataset.screen === screenId);
+  });
+}
+
+navButtons.forEach((btn) => {
+  btn.addEventListener('click', () => {
+    setActiveScreen(btn.dataset.screen);
+  });
+});
+
+function updateLicenseState(state) {
+  licenseBadges.forEach((badge) => {
+    badge.dataset.state = state;
+    badge.textContent =
+      state === 'active'
+        ? 'Ativa'
+        : state === 'delinquent'
+        ? 'Inadimplente'
+        : 'Suspensa';
+  });
+
+  statusBadge.dataset.state = state === 'active' ? 'active' : 'inactive';
+  statusBadge.textContent =
+    state === 'active' ? 'Registro ativo' : 'Registro suspenso';
+}
+
+licenseButtons.forEach((btn) => {
+  btn.addEventListener('click', () => {
+    licenseButtons.forEach((other) => other.classList.remove('active'));
+    btn.classList.add('active');
+    updateLicenseState(btn.dataset.license);
+  });
+});
+
+// state on load
+setActiveScreen('dashboard');
+updateLicenseState('active');
 
EOF
)
