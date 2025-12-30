import Image from "next/image";
import Reveal from "@/components/marketing/motion/Reveal";
import styles from "@/app/(marketing)/page.module.css";

type Persona = "male" | "female";

export default function PersonaSection(props: {
  persona: Persona;
  kicker?: string;
  title?: string;
  body?: string;
  bullets?: string[];
}) {
  const persona = props.persona;

  const imgSrc = persona === "female" ? "/femaleicon.png" : "/maleicon.png";
  const imgAlt = persona === "female" ? "Kallr AI Receptionist (female)" : "Kallr AI Receptionist (male)";
  const imageSide: "left" | "right" = persona === "female" ? "left" : "right";

  const kicker = props.kicker ?? "Human-sounding AI, always on";
  const title =
    props.title ??
    (persona === "female"
      ? "A Receptionist Experience That Feels Personal"
      : "A Receptionist Experience Built for Speed & Clarity");

  const body =
    props.body ??
    "Kallr answers in a natural voice, asks the right questions, captures clean notes, and routes the next step—24/7. No missed calls. No awkward hand-offs. Just a consistent intake that converts.";

  const bullets =
    props.bullets ??
    [
      "Natural voice + clean conversation flow",
      "Qualifies leads with your exact questions",
      "Books or routes based on rules you choose",
      "Text follow-ups that keep leads warm",
    ];

  const Figure = (
    <div className={styles.personaFigure}>
      <Image src={imgSrc} alt={imgAlt} width={420} height={420} priority />
    </div>
  );

  const Bubble = (
    <div className={styles.personaBubble}>
      <div className={styles.personaKicker}>{kicker}</div>
      <h3 className={styles.personaTitle}>{title}</h3>
      <p className={styles.personaText}>{body}</p>
      <ul className={styles.personaList}>
        {bullets.map((b) => (
          <li key={b}>{b}</li>
        ))}
      </ul>
    </div>
  );

  return (
    <Reveal as="section" className={`${styles.section} ${styles.personaSection}`} delayMs={40}>
      <div className={styles.container}>
        <div className={styles.personaSplit}>
          {imageSide === "left" ? (
            <>
              <Reveal as="div" delayMs={80}>
                {Figure}
              </Reveal>
              <Reveal as="div" delayMs={140}>
                {Bubble}
              </Reveal>
            </>
          ) : (
            <>
              <Reveal as="div" delayMs={80}>
                {Bubble}
              </Reveal>
              <Reveal as="div" delayMs={140}>
                {Figure}
              </Reveal>
            </>
          )}
        </div>
      </div>
    </Reveal>
  );
}
