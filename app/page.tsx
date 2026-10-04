import type { Metadata } from "next";
import { About } from "@/components/About/About";
import { Contact } from "@/components/Contact/Contact";
import { ExperienceProvider } from "@/components/Experience/ExperienceProvider";
import { Header } from "@/components/Header/Header";
import { Hero } from "@/components/Hero/Hero";
import { Loader } from "@/components/Loader/Loader";
import { Marquee } from "@/components/Marquee/Marquee";
import { Models } from "@/components/Models/Models";
import { Music } from "@/components/Music/Music";
import { Show } from "@/components/Show/Show";
import { Videos } from "@/components/Videos/Videos";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

export default function Home() {
  return (
    <ExperienceProvider>
      <Loader />
      {/* data-experience-home: o que sai de cena quando uma subtela ("Ver mais") abre */}
      <Header />
      <main data-experience-home>
        <Hero />
        <Marquee />
        <About />
        <Videos />
        <Music />
        <Marquee />
        <Models />
        <Show />
        <Contact />
      </main>
    </ExperienceProvider>
  );
}
