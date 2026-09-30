import { getSupabase } from './supabase-client.js';

const requestForm = document.querySelector('#requestReset');
const updateForm = document.querySelector('#updatePassword');
const message = document.querySelector('#message');
const instructions = document.querySelector('#instructions');
const fragment = new URLSearchParams(location.hash.slice(1));
const linkError = fragment.get('error_description') || fragment.get('error');
let sb;
function show(text, error = false) {
  message.textContent = text;
  message.style.color = error ? '#a22' : 'inherit';
}
function showUpdate() {
  requestForm.hidden = true;
  updateForm.hidden = false;
  instructions.textContent = 'Choose a new password with at least 12 characters.';
}
requestForm.onsubmit = async event => {
  event.preventDefault();
  const button = requestForm.querySelector('button');
  button.disabled = true;
  show('Requesting reset link…');
  try {
    if (!sb) throw new Error('Authentication is not ready. Reload and try again.');
    const email = new FormData(requestForm).get('email').trim();
    const redirectTo = new URL('./reset-password.html', location.href).href;
    const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo });
    if (error) throw error;
    show('If this email belongs to an account, a reset link has been requested. Check your inbox and spam folder, then open the latest link.');
  } catch (error) { show(error.message || 'Unable to request a reset link.', true); }
  finally { button.disabled = false; }
};
updateForm.onsubmit = async event => {
  event.preventDefault();
  const data = new FormData(updateForm);
  const password = data.get('password');
  if (password !== data.get('confirm')) { show('The passwords do not match.', true); return; }
  const button = updateForm.querySelector('button');
  button.disabled = true;
  try {
    const { data: identity, error: identityError } = await sb.auth.getUser();
    if (identityError || !identity.user) throw new Error('The reset session has expired. Request a new reset link.');
    const { error } = await sb.auth.updateUser({ password });
    if (error) throw error;
    updateForm.reset();
    updateForm.hidden = true;
    instructions.textContent = 'Your password has been updated.';
    const { error: signOutError } = await sb.auth.signOut({ scope: 'local' });
    show(signOutError ? 'Password saved. Return to sign in; this browser session could not be cleared.' : 'Return to sign in and use your new password.');
  } catch (error) { show(error.message || 'Unable to update your password.', true); }
  finally { button.disabled = false; }
};
try {
  sb = await getSupabase();
  if (!sb) throw new Error('Password recovery requires a connected warehouse environment.');
  sb.auth.onAuthStateChange((event, session) => {
    if (event === 'PASSWORD_RECOVERY' && session && !linkError) showUpdate();
  });
  const { data, error } = await sb.auth.getSession();
  if (error) throw error;
  if (linkError) {
    history.replaceState(null, '', location.pathname);
    show('This reset link is invalid or expired. Request a new link below.', true);
  } else if (data.session) showUpdate();
} catch (error) { show(error.message || 'Unable to connect to authentication.', true); }
