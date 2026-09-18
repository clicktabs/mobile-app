import { Linking } from 'react-native';

import { WEB_BASE_URL } from '../config/env';
import { confirmAction, showAlert } from './confirm';
import { storageGet, storageSet } from './storage';

/** Remembers that the browser hand-off has been explained, so it is said once. */
const PAYROLL_LINK_SEEN = 'ct_payroll_link_seen';

/**
 * Opens the Payroll Console in the device browser.
 *
 * The console is not rebuilt in the app on purpose. Its stages price a batch, release
 * compliance holds and send a payout — work that wants the whole batch in view and is
 * close to irreversible — and a second implementation of those rules would be the thing
 * that eventually disagrees with the first. The console's own layout works at phone width
 * now, so the browser is a real answer rather than a dodge.
 *
 * It authenticates with a web session, not this app's token, so the first visit asks for a
 * sign-in. Said once, up front: a login screen appearing out of an app you are already
 * signed in to reads as the app having logged you out. The browser keeps the session
 * afterwards, so the warning is not repeated.
 *
 * Lives here rather than in a screen because both the dashboard and the menu offer it, and
 * two copies of a hand-off this fiddly would drift.
 */
export async function openPayrollConsole(): Promise<void> {
  const url = `${WEB_BASE_URL}/payroll`;

  if (!(await Linking.canOpenURL(url))) {
    showAlert('Could not open', `No browser could open ${url}.`, 'error');
    return;
  }

  if (!(await storageGet(PAYROLL_LINK_SEEN))) {
    const go = await confirmAction(
      'Opens in your browser',
      'The Payroll Console is a web screen. You may be asked to sign in the first time — that is the website, not this app.',
      { confirmLabel: 'Open' },
    );

    if (!go) return;

    await storageSet(PAYROLL_LINK_SEEN, '1');
  }

  await Linking.openURL(url);
}
