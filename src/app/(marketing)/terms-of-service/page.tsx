import styles from "@/app/(marketing)/page.module.css";
import Reveal from "@/components/marketing/motion/Reveal";

export default function TermsOfServicePage() {
  return (
    <div className={styles.page}>
      <Reveal as="section" className={styles.hero}>
        <div className={styles.container}>
          <div className={styles.heroInner}>
            <div className={styles.pill}>Legal</div>
            <h1 className={styles.h1}>Terms of Service</h1>
            <p className={styles.subhead}>Last updated: December 2024</p>
          </div>
        </div>
      </Reveal>

      <div className={styles.divider} />

      <Reveal as="section" className={styles.section} delayMs={40}>
        <div className={styles.container}>
          <div className={styles.panel}>
            <h3 className={styles.panelTitle}>Agreement to Terms</h3>
            <p className={styles.sectionSub} style={{ textAlign: "left" }}>
              By accessing or using Kallr’s website and services, you agree to be bound by these Terms of Service.
              If you do not agree, do not use our services.
            </p>

            <h3 className={styles.panelTitle} style={{ marginTop: 18 }}>Services</h3>
            <p className={styles.sectionSub} style={{ textAlign: "left" }}>
              Kallr provides AI receptionist, SMS automation, SEO, and related business workflow services.
              Services may include, but are not limited to:
            </p>
            <ul className={styles.checkList}>
              <li>AI phone answering, lead qualification, and routing</li>
              <li>SMS/text follow-ups and automation workflows</li>
              <li>Conversion-focused marketing pages and local SEO support</li>
              <li>Integrations with calendars, CRMs, and other tools</li>
              <li>Reporting and optimization</li>
            </ul>

            <h3 className={styles.panelTitle} style={{ marginTop: 18 }}>SMS/Text Messaging Terms</h3>
            <p className={styles.sectionSub} style={{ textAlign: "left" }}>
              By providing your mobile phone number and opting in to receive text messages from Kallr,
              you expressly consent to receive recurring automated text messages at the number provided.
              Messages may include:
            </p>
            <ul className={styles.checkList}>
              <li>Appointment reminders and scheduling confirmations</li>
              <li>Service updates and important notifications</li>
              <li>Responses to your support inquiries</li>
              <li>Promotional messages (only if you opt in)</li>
            </ul>
            <ul className={styles.checkList}>
              <li><b>Consent:</b> Your consent to receive texts is not a condition of purchase.</li>
              <li><b>Message frequency:</b> Varies; you may receive up to 10 messages/month depending on interactions.</li>
              <li><b>Message & data rates:</b> Standard carrier rates may apply.</li>
              <li><b>Opt-out:</b> Reply <b>STOP</b> to unsubscribe. You will receive one final confirmation message.</li>
              <li><b>Opt back in:</b> Reply <b>START</b> to resubscribe.</li>
              <li><b>Help:</b> Reply <b>HELP</b> for assistance.</li>
              <li><b>Eligibility:</b> You confirm you are the account holder or authorized user of the phone number provided.</li>
            </ul>

            <h3 className={styles.panelTitle} style={{ marginTop: 18 }}>User Responsibilities</h3>
            <ul className={styles.checkList}>
              <li>Provide accurate and complete information</li>
              <li>Maintain confidentiality of any credentials</li>
              <li>Use services only for lawful purposes</li>
              <li>Do not interfere with or disrupt our services</li>
              <li>Comply with applicable laws, including messaging/telecommunications rules</li>
            </ul>

            <h3 className={styles.panelTitle} style={{ marginTop: 18 }}>Intellectual Property</h3>
            <p className={styles.sectionSub} style={{ textAlign: "left" }}>
              All content on this website, including text, graphics, logos, and software, is owned by Kallr or its licensors
              and is protected by intellectual property laws. You may not reproduce, distribute, or create derivative works
              without written permission.
            </p>

            <h3 className={styles.panelTitle} style={{ marginTop: 18 }}>Payment Terms</h3>
            <p className={styles.sectionSub} style={{ textAlign: "left" }}>
              Payment terms are set in individual service agreements. Unless otherwise stated:
            </p>
            <ul className={styles.checkList}>
              <li>Invoices are due within 30 days of receipt</li>
              <li>Monthly services may be billed in advance</li>
              <li>Late payments may incur additional fees</li>
              <li>We may suspend services for non-payment</li>
            </ul>

            <h3 className={styles.panelTitle} style={{ marginTop: 18 }}>Disclaimer of Warranties</h3>
            <p className={styles.sectionSub} style={{ textAlign: "left" }}>
              Services are provided “as is” and “as available” without warranties of any kind. We do not guarantee specific results.
              Outcomes may vary based on factors outside our control (market demand, competition, customer behavior, platform changes, etc.).
            </p>

            <h3 className={styles.panelTitle} style={{ marginTop: 18 }}>Limitation of Liability</h3>
            <p className={styles.sectionSub} style={{ textAlign: "left" }}>
              To the fullest extent permitted by law, Kallr will not be liable for indirect, incidental, special, consequential,
              or punitive damages. Our total liability will not exceed the amount paid by you for the services in question.
            </p>

            <h3 className={styles.panelTitle} style={{ marginTop: 18 }}>Termination</h3>
            <p className={styles.sectionSub} style={{ textAlign: "left" }}>
              Either party may terminate according to the applicable service agreement. We may suspend or terminate access for violations
              of these Terms, unlawful use, or non-payment.
            </p>

            <h3 className={styles.panelTitle} style={{ marginTop: 18 }}>Governing Law</h3>
            <p className={styles.sectionSub} style={{ textAlign: "left" }}>
              These Terms are governed by the laws of the state in which Kallr is principally operated, without regard to conflict-of-law provisions.
            </p>

            <h3 className={styles.panelTitle} style={{ marginTop: 18 }}>Changes to Terms</h3>
            <p className={styles.sectionSub} style={{ textAlign: "left" }}>
              We may update these Terms at any time. Changes are effective when posted. Continued use constitutes acceptance.
            </p>

            <h3 className={styles.panelTitle} style={{ marginTop: 18 }}>Contact</h3>
            <p className={styles.sectionSub} style={{ textAlign: "left" }}>
              Questions about these Terms?
              <br />
              <b>Email:</b> nickalves75@gmail.com
            </p>
          </div>
        </div>
      </Reveal>
    </div>
  );
}
