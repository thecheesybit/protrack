/**
 * Privacy Policy + Terms presented at the first-run legal gate and in Settings.
 * Plain data so the same source renders in onboarding and the about pane. The
 * copy reflects PRO TRACK's actual data practices — keep it truthful if the
 * architecture changes.
 */

export const LEGAL_VERSION = 1
export const LEGAL_UPDATED = 'June 2026'

export const PRIVACY_POLICY = {
  title: 'Privacy Policy',
  intro:
    'PRO TRACK is a personal productivity workspace. We collect the minimum needed to run your account and sync your data across your devices — nothing more.',
  sections: [
    {
      heading: 'What we store',
      body: 'Your Google account basics (name, email, profile photo) and the workspace content you create — modes, subjects, tasks, habits, focus history and analytics — are stored in Google Firebase Firestore, bound to your account.',
    },
    {
      heading: 'What stays only on your device',
      body: 'Your Gemini API key lives in your browser local storage and is never written to our servers. Your Google Calendar access token is held in session memory only. On the desktop app, your session and a hardware fingerprint are encrypted locally to bind this machine to your account.',
    },
    {
      heading: 'Third-party processors',
      body: 'Google provides authentication and Firestore. Google Gemini processes only the text you choose to send to the AI companion, and only when you supply your own API key. We do not use advertising or analytics trackers.',
    },
    {
      heading: 'What we never do',
      body: 'We never sell your data, never show ads, and never share your workspace content with third parties for marketing.',
    },
    {
      heading: 'Retention and deletion',
      body: 'Deleting a mode removes its associated content. You can request full account deletion at any time, after which your stored data is removed from Firestore.',
    },
  ],
}

export const TERMS = {
  title: 'Terms & Conditions',
  intro:
    'By using PRO TRACK you agree to these terms. They exist to keep the service fair, safe, and sustainable on a free-tier backend.',
  sections: [
    {
      heading: 'License and use',
      body: 'PRO TRACK is provided for personal, non-commercial productivity use. You may not resell, sublicense, or redistribute the application or its source without permission.',
    },
    {
      heading: 'Your responsibilities',
      body: 'You are responsible for the security of your Google account and any API keys you provide. Any usage costs incurred with Google Gemini or other services under your own keys are your responsibility.',
    },
    {
      heading: 'Acceptable use',
      body: 'Do not use the service to store unlawful content or to attempt to disrupt, reverse-engineer for abuse, or overload the shared backend.',
    },
    {
      heading: 'No warranty',
      body: 'The application is provided "as is", without warranty of any kind. Focus sessions, reminders, and sync are best-effort and should not be relied upon as the sole record of critical information.',
    },
    {
      heading: 'Limitation of liability',
      body: 'To the maximum extent permitted by law, the creator is not liable for any indirect or incidental loss arising from use of the application.',
    },
    {
      heading: 'Changes',
      body: 'These terms may be updated as the product evolves. Material changes will be surfaced again for your acceptance.',
    },
  ],
}
