/* Nabura Labs inquiry form. No credentials or recipient addresses are sent in configuration.
 * Formspree recipient and spam settings belong in the owner's Formspree dashboard.
 * Browser SDK API: https://help.formspree.io/articles/building-your-form/submit-forms-with-javascript-ajax
 */
(() => {
  'use strict';
  const form = document.getElementById('project-form');
  if (!form || form.dataset.naburaContactInitialized === 'true') return;
  form.dataset.naburaContactInitialized = 'true';
  form.noValidate = true;
  const submit = document.getElementById('submit-button');
  const note = document.getElementById('form-mode');
  const error = document.getElementById('form-error');
  const success = document.getElementById('form-success');
  const interest = document.getElementById('interest');
  const problem = document.getElementById('problem');
  const inputs = [...form.querySelectorAll('input:not([type="hidden"]):not([name="_gotcha"]), textarea, select')];
  let ready = false;
  let inFlight = false;
  let slowTimer;
  let loadTimer;
  let loadExpired = false;
  const reference = () => window.crypto?.randomUUID?.() || `inquiry-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  let requestReference = reference();

  const setNote = text => { note.textContent = text; };
  const showError = message => {
    error.textContent = message;
    error.hidden = false;
    error.focus();
  };
  const clearError = () => { error.hidden = true; error.textContent = ''; };
  const stopBusy = () => {
    clearTimeout(slowTimer);
    inFlight = false;
    form.removeAttribute('aria-busy');
    submit.disabled = !ready;
    submit.textContent = 'Send inquiry';
  };
  const showFailure = () => {
    stopBusy();
    setNote('Your details remain in this form. They are not stored in this browser after you close or reload the page.');
    showError('We could not confirm your submission. Please try again or email essam@naburalabs.com.');
  };
  const unavailable = () => {
    ready = false;
    stopBusy();
    setNote('Online submission is temporarily unavailable. Please email essam@naburalabs.com. Nothing has been sent.');
    showError('The contact service could not be loaded. Please email Nabura Labs using the address beside this form.');
  };

  // Only the hard-coded form action is accepted. Query strings cannot change recipients or endpoints.
  let endpoint;
  try { endpoint = new URL(form.getAttribute('action')); } catch { unavailable(); return; }
  if (endpoint.origin !== 'https://formspree.io' || !/^\/f\/[a-zA-Z0-9]+$/.test(endpoint.pathname) || endpoint.search || endpoint.hash || endpoint.username || endpoint.password) {
    unavailable();
    return;
  }
  const formId = endpoint.pathname.split('/').pop();
  submit.disabled = true;
  setNote('Connecting the inquiry form. You can also email essam@naburalabs.com directly.');

  // Preserve package selection and query-string preselection without accepting arbitrary options.
  function selectService(value) {
    if (interest && [...interest.options].some(option => option.value === value)) interest.value = value;
  }
  function showForm() {
    if (inFlight) return;
    success.hidden = true;
    form.hidden = false;
    clearError();
    if (ready) setNote('Submit directly to Nabura Labs. No email app or marketing subscription is required.');
  }
  selectService(new URLSearchParams(window.location.search).get('interest'));
  document.querySelectorAll('[data-interest]').forEach(link => link.addEventListener('click', () => {
    if (inFlight) return;
    showForm();
    selectService(link.dataset.interest);
    if (problem && link.dataset.problem && !problem.value.trim()) problem.value = link.dataset.problem;
    requestReference = reference();
  }));
  document.getElementById('new-inquiry')?.addEventListener('click', () => {
    showForm();
    document.getElementById('name')?.focus();
  });
  const onEdit = event => {
    if (inFlight) return;
    event.target.removeAttribute('aria-invalid');
    clearError();
    requestReference = reference();
  };
  form.addEventListener('input', onEdit);
  form.addEventListener('change', onEdit);

  // Capture-phase guard runs BEFORE the SDK submission listener, preventing double submissions.
  form.addEventListener('submit', event => {
    const block = () => { event.preventDefault(); event.stopImmediatePropagation(); };
    if (inFlight) { block(); return; }
    if (!ready) { block(); showError('The contact service is not ready. Please wait a moment or email essam@naburalabs.com.'); return; }
    inputs.forEach(field => {
      if (field.tagName !== 'SELECT') field.value = field.value.trim();
      field.removeAttribute('aria-invalid');
    });
    const invalid = inputs.find(field => !field.checkValidity() || (field.minLength > 0 && field.value.length < field.minLength) || (field.maxLength > 0 && field.value.length > field.maxLength));
    if (invalid) {
      block();
      invalid.setAttribute('aria-invalid', 'true');
      const message = invalid.id === 'problem' ? 'Please describe your project in 20 to 1500 characters.' : `Please enter a valid ${invalid.id === 'email' ? 'email address' : invalid.id}.`;
      showError(message);
      invalid.focus();
      return;
    }
    if (form.querySelector('[name="_gotcha"]').value) {
      block();
      showError('The inquiry could not be submitted. Please email Nabura Labs directly.');
      return;
    }
    clearError();
    inFlight = true;
    submit.disabled = true;
    form.setAttribute('aria-busy', 'true');
  }, true);

  // Official browser SDK handles Formspree responses and supported CAPTCHA challenges.
  // This public major-version URL is the provider's documented no-build integration.
  window.formspree = window.formspree || function () {
    (window.formspree.q = window.formspree.q || []).push(arguments);
  };
  window.formspree('initForm', {
    formElement: '#project-form',
    formId,
    data: {
      subject: 'Nabura Labs project inquiry',
      client_reference: () => requestReference
    },
    onInit: () => {
      if (loadExpired) return;
      clearTimeout(loadTimer);
      ready = true;
      submit.disabled = false;
      setNote('Submit directly to Nabura Labs. No email app or marketing subscription is required.');
    },
    disable: () => { submit.disabled = true; },
    enable: () => { if (ready && !inFlight) submit.disabled = false; },
    onSubmit: () => {
      inFlight = true;
      form.setAttribute('aria-busy', 'true');
      submit.disabled = true;
      submit.textContent = 'Sending inquiry…';
      setNote('Submitting your inquiry. Please keep this page open.');
      clearTimeout(slowTimer);
      slowTimer = setTimeout(() => {
        if (inFlight) setNote('The submission is taking longer than expected and is not confirmed yet. Please keep this page open to avoid sending it twice.');
      }, 25000);
    },
    // Keep presentation under Nabura Labs control. Never show a success state on an error callback.
    renderSuccess: () => {},
    renderFieldErrors: () => {},
    renderFormError: () => {},
    onSuccess: () => {
      stopBusy();
      clearError();
      document.getElementById('success-title').textContent = 'Thank you. Your inquiry has been submitted.';
      document.getElementById('success-description').textContent = 'Your submission was accepted by our contact service. Nabura Labs will review your inquiry and contact you using the email provided.';
      form.reset();
      requestReference = reference();
      form.hidden = true;
      success.hidden = false;
      success.focus();
    },
    onError: showFailure,
    onFailure: showFailure
  });
  const sdk = document.createElement('script');
  sdk.src = 'https://unpkg.com/@formspree/ajax@1';
  sdk.async = true;
  sdk.referrerPolicy = 'no-referrer';
  sdk.onerror = () => { clearTimeout(loadTimer); loadExpired = true; unavailable(); };
  loadTimer = setTimeout(() => {
    if (!ready) { loadExpired = true; unavailable(); }
  }, 15000);
  if (!ready) document.head.append(sdk);
  else clearTimeout(loadTimer);
})();
