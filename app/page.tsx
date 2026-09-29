import { About } from "@/components/About/About";
import { Contact } from "@/components/Contact/Contact";
import { Header } from "@/components/Header/Header";
import { Hero } from "@/components/Hero/Hero";
import { Marquee } from "@/components/Marquee/Marquee";
import { Models } from "@/components/Models/Models";
import { Music } from "@/components/Music/Music";
import { Videos } from "@/components/Videos/Videos";

export default function Home() {
  return (
    <>
      <Header />
      <main>
        <Hero />
        <Marquee />
        <About />
        <Videos />
        <Music />
        <Marquee />
        <Models />
        <Contact />
      </main>
    </>
  );
}
