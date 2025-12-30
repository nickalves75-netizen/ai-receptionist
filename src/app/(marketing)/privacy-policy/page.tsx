import styles from "@/app/(marketing)/page.module.css";
import Reveal from "@/components/marketing/motion/Reveal";

export default function PrivacyPolicyPage() {
  return (
    <div className={styles.page}>
      <Reveal as="section" className={styles.hero}>
        <div className={styles.container}>
          <div className={styles.heroInner}>
            <div className={styles.pill}>Legal</div>
            <h1 className={styles.h1}>Privacy Policy</h1>
            <p className={styles.subhead}>
              Last updated: December 2024
            </p>
          </div>
        </div>
      </Reveal>

      <div className={styles.divider} />

      <Reveal as="section" className={styles.section} delayMs={40}>
        <div className={styles.container}>
          <div className={styles.panel}>
            <h3 className={styles.panelTitle}>Introduction</h3>
            <p className={styles.sectionSub} style={{ textAlign: "left" }}>
              Kallr (“we,” “our,” or “us”) respects your privacy and is committed to protecting your personal data.
              This Privacy Policy explains how we collect, use, share, and safeguard information when you visit our website,
              request a consultation, or use our services.
            </p>

            <h3 className={styles.panelTitle} style={{ marginTop: 18 }}>Information We Collect</h3>
            <ul className={styles.checkList}>
              <li><b>Contact Information:</b> name, email, phone number, company name</li>
              <li><b>Business Information:</b> industry, services offered, service areas, intake preferences</li>
              <li><b>Usage Data:</b> interactions with pages, forms, and site performance analytics</li>
              <li><b>Technical Data:</b> IP address, device/browser type, approximate location, log data</li>
            </ul>

            <h3 className={styles.panelTitle} style={{ marginTop: 18 }}>How We Use Your Information</h3>
            <ul className={styles.checkList}>
              <li>Provide, operate, and improve Kallr services</li>
              <li>Respond to inquiries, schedule consultations, and deliver support</li>
              <li>Send service-related messages and updates</li>
              <li>Send marketing communications when you opt in (you can opt out anytime)</li>
              <li>Monitor, secure, and maintain our systems</li>
              <li>Comply with legal obligations and enforce agreements</li>
            </ul>

            <h3 className={styles.panelTitle} style={{ marginTop: 18 }}>SMS/Text Messaging Privacy</h3>
            <p className={styles.sectionSub} style={{ textAlign: "left" }}>
              If you provide a phone number and opt in to receive text messages from Kallr, we may send SMS/text messages related to:
            </p>
            <ul className={styles.checkList}>
              <li>Appointment reminders and scheduling confirmations</li>
              <li>Service updates and important notifications</li>
              <li>Responses to your questions and support requests</li>
              <li>Promotional and marketing messages (only if you opt in)</li>
            </ul>
            <p className={styles.sectionSub} style={{ textAlign: "left" }}>
              <b>We do not sell your phone number.</b> We will never share, sell, or rent your phone number to third parties for their marketing purposes.
              We only use it for the purposes described in this Policy and to provide our services.
            </p>

            <ul className={styles.checkList}>
              <li><b>Consent:</b> Consent to receive texts is not a condition of purchase.</li>
              <li><b>Message frequency:</b> Varies based on your interactions; you may receive up to 10 messages/month.</li>
              <li><b>Message & data rates:</b> Standard carrier rates may apply.</li>
              <li><b>Opt-out:</b> Reply <b>STOP</b> to any message to unsubscribe. You will receive one final confirmation message.</li>
              <li><b>Opt back in:</b> Reply <b>START</b> to resume messages.</li>
              <li><b>Help:</b> Reply <b>HELP</b> for assistance.</li>
              <li><b>Carriers:</b> Major US carriers supported; carrier participation may vary.</li>
            </ul>

            <h3 className={styles.panelTitle} style={{ marginTop: 18 }}>Data Sharing</h3>
            <p className={styles.sectionSub} style={{ textAlign: "left" }}>
              We do not sell your personal information. We may share data with:
            </p>
            <ul className={styles.checkList}>
              <li><b>Service providers</b> who help operate our website and services (e.g., analytics, communications, hosting)</li>
              <li><b>Professional advisors</b> (e.g., legal, accounting) where necessary</li>
              <li><b>Legal authorities</b> when required by law or to protect rights, safety, and security</li>
            </ul>

            <h3 className={styles.panelTitle} style={{ marginTop: 18 }}>Cookies & Analytics</h3>
            <p className={styles.sectionSub} style={{ textAlign: "left" }}>
              We use cookies and similar technologies to improve performance and understand usage. You can control cookies through your browser settings.
            </p>

            <h3 className={styles.panelTitle} style={{ marginTop: 18 }}>Data Security</h3>
            <p className={styles.sectionSub} style={{ textAlign: "left" }}>
              We implement reasonable technical and organizational measures to protect personal data. No method of transmission or storage is 100% secure,
              so we cannot guarantee absolute security.
            </p>

            <h3 className={styles.panelTitle} style={{ marginTop: 18 }}>Your Rights</h3>
            <ul className={styles.checkList}>
              <li>Request access to personal data we hold about you</li>
              <li>Request correction of inaccurate information</li>
              <li>Request deletion of certain information (subject to legal requirements)</li>
              <li>Opt out of marketing communications</li>
            </ul>

            <h3 className={styles.panelTitle} style={{ marginTop: 18 }}>Contact</h3>
            <p className={styles.sectionSub} style={{ textAlign: "left" }}>
              If you have questions about this Privacy Policy or our data practices, contact us at:
              <br />
              <b>Email:</b> kallr.solutions@gmail.com
            </p>

            <h3 className={styles.panelTitle} style={{ marginTop: 18 }}>Changes to This Policy</h3>
            <p className={styles.sectionSub} style={{ textAlign: "left" }}>
              We may update this Privacy Policy from time to time. Changes are effective upon posting, and the “Last updated” date will be revised.
            </p>
          </div>
        </div>
      </Reveal>
    </div>
  );
}
