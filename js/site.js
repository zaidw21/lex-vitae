(function () {
	"use strict";

	var CONTACT_EMAIL = "ashhar@lexvitaelegal.com";
	var DISCLAIMER_KEY = "lexvitae-disclaimer-accepted";

	function storageGet(key) {
		try { return window.localStorage.getItem(key); } catch (e) { return null; }
	}

	function storageSet(key, value) {
		try { window.localStorage.setItem(key, value); } catch (e) { /* private mode: ask again next visit */ }
	}

	// Bar Council disclaimer: shown until the visitor agrees, and on demand from the footer.
	var dialog = document.getElementById("disclaimer");
	if (dialog && typeof dialog.showModal === "function") {
		document.getElementById("disclaimer-agree").addEventListener("click", function () {
			storageSet(DISCLAIMER_KEY, "1");
			dialog.close();
		});
		// Esc must not dismiss the disclaimer without agreeing.
		dialog.addEventListener("cancel", function (event) {
			if (!storageGet(DISCLAIMER_KEY)) event.preventDefault();
		});
		document.getElementById("show-disclaimer").addEventListener("click", function () {
			dialog.showModal();
		});
		if (!storageGet(DISCLAIMER_KEY)) dialog.showModal();
	}

	// Header: solid background once scrolled, mobile menu toggle.
	var header = document.querySelector(".site-header");
	var toggle = document.querySelector(".nav-toggle");

	function onScroll() {
		header.classList.toggle("is-scrolled", window.scrollY > 40);
	}
	window.addEventListener("scroll", onScroll, { passive: true });
	onScroll();

	function setMenu(open) {
		header.classList.toggle("is-open", open);
		toggle.setAttribute("aria-expanded", String(open));
	}
	toggle.addEventListener("click", function () {
		setMenu(toggle.getAttribute("aria-expanded") !== "true");
	});
	document.querySelectorAll(".site-nav a").forEach(function (link) {
		link.addEventListener("click", function () { setMenu(false); });
	});

	// Highlight the nav link for the section in view.
	if ("IntersectionObserver" in window) {
		var navLinks = {};
		document.querySelectorAll('.site-nav a[href^="#"]').forEach(function (link) {
			navLinks[link.getAttribute("href").slice(1)] = link;
		});
		var observer = new IntersectionObserver(function (entries) {
			entries.forEach(function (entry) {
				var link = navLinks[entry.target.id];
				if (!link) return;
				if (entry.isIntersecting) {
					Object.keys(navLinks).forEach(function (id) { navLinks[id].removeAttribute("aria-current"); });
					link.setAttribute("aria-current", "true");
				}
			});
		}, { rootMargin: "-45% 0px -50% 0px" });
		Object.keys(navLinks).forEach(function (id) {
			var section = document.getElementById(id);
			if (section) observer.observe(section);
		});
	}

	// Practice-area tabs (WAI-ARIA tabs pattern with arrow-key navigation).
	document.querySelectorAll("[data-tabs]").forEach(function (container) {
		var tabs = Array.prototype.slice.call(container.querySelectorAll('[role="tab"]'));

		function select(tab) {
			tabs.forEach(function (t) {
				var selected = t === tab;
				t.setAttribute("aria-selected", String(selected));
				t.tabIndex = selected ? 0 : -1;
				document.getElementById(t.getAttribute("aria-controls")).hidden = !selected;
			});
		}

		tabs.forEach(function (tab, i) {
			tab.addEventListener("click", function () { select(tab); });
			tab.addEventListener("keydown", function (event) {
				var next = null;
				if (event.key === "ArrowRight") next = tabs[(i + 1) % tabs.length];
				else if (event.key === "ArrowLeft") next = tabs[(i - 1 + tabs.length) % tabs.length];
				else if (event.key === "Home") next = tabs[0];
				else if (event.key === "End") next = tabs[tabs.length - 1];
				if (next) {
					event.preventDefault();
					select(next);
					next.focus();
				}
			});
		});
	});

	// Contact form: validate, then open the visitor's mail client with the request pre-filled.
	var form = document.getElementById("contact-form");
	var status = form.querySelector(".form-status");

	form.addEventListener("submit", function (event) {
		event.preventDefault();
		var firstInvalid = null;
		Array.prototype.forEach.call(form.elements, function (field) {
			if (!field.willValidate) return;
			var valid = field.checkValidity() && (!field.required || field.value.trim() !== "");
			field.setAttribute("aria-invalid", String(!valid));
			if (!valid && !firstInvalid) firstInvalid = field;
		});

		if (firstInvalid) {
			status.className = "form-status is-error";
			status.textContent = "Please fill in your name, a valid email address and your message.";
			firstInvalid.focus();
			return;
		}

		var data = new FormData(form);
		var body = [
			"Name: " + data.get("name"),
			"Email: " + data.get("email"),
			"Phone: " + (data.get("phone") || "-"),
			"Area of law: " + data.get("area"),
			"",
			data.get("message")
		].join("\n");
		var subject = "Consultation request: " + data.get("area");

		window.location.href = "mailto:" + CONTACT_EMAIL +
			"?subject=" + encodeURIComponent(subject) +
			"&body=" + encodeURIComponent(body);

		status.className = "form-status is-success";
		status.textContent = "Your email app should now open with your message. If it doesn't, email us at " +
			CONTACT_EMAIL + ".";
	});

	document.getElementById("year").textContent = new Date().getFullYear();
})();
