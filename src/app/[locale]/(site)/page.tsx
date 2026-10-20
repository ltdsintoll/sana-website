import EmailCapture from "@/components/EmailCapture";
import FAQ from "@/components/FAQ";
import Features from "@/components/Features";
import Hero from "@/components/Hero";
import HowItWorks from "@/components/HowItWorks";
import JsonLd from "@/components/JsonLd";
import PrivacySection from "@/components/PrivacySection";
import ScreenshotsGallery from "@/components/ScreenshotsGallery";
import TrustStrip from "@/components/TrustStrip";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://sanacycle.com";

export default function HomePage() {
  const organizationLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Sana",
    url: SITE_URL,
    logo: `${SITE_URL}/icon`,
    sameAs: ["https://t.me/sanacyclebot"],
  };

  const softwareLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Sana",
    applicationCategory: "HealthApplication",
    operatingSystem: "Telegram",
    url: SITE_URL,
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
    description:
      "Calm cycle tracking, right inside Telegram. No ads, no data selling.",
  };

  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "Is Sana really free?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Yes. Core tracking, partner mode, and all six themes are free forever.",
        },
      },
      {
        "@type": "Question",
        name: "Do I need to install an app?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "No. Sana runs inside Telegram as a Mini App. Open the bot, and you're in.",
        },
      },
      {
        "@type": "Question",
        name: "Do you sell my data?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Never. No ad networks, no data brokers. Your cycle data is not a product.",
        },
      },
      {
        "@type": "Question",
        name: "Is Sana only for women?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "No. Sana is for anyone with a cycle. Language is inclusive throughout.",
        },
      },
    ],
  };

  return (
    <main>
      <JsonLd data={organizationLd} />
      <JsonLd data={softwareLd} />
      <JsonLd data={faqLd} />
      <Hero />
      <TrustStrip />
      <HowItWorks />
      <Features />
      <ScreenshotsGallery />
      <PrivacySection />
      <FAQ />
      <EmailCapture />
    </main>
  );
}
