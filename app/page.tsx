import type { Metadata } from "next";
import { About } from "@/components/About/About";
import { Agenda } from "@/components/Agenda/Agenda";
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
import { VideosProvider } from "@/components/Videos/videosContext";
import { loadPublicAgenda } from "@/lib/agenda/publicAgenda";
import { loadShowModels } from "@/lib/showModels/publicShowModels";
import { loadVideoCollection } from "@/lib/videos/publicVideos";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

/*
 * Página estática, regenerada quando o painel altera os vídeos, os modelos de show ou a agenda
 * (revalidatePath("/") nas Server Actions). O intervalo é só uma rede de segurança para
 * mudanças feitas fora do painel.
 */
export const revalidate = 3600;

export default async function Home() {
  const [videos, showModels, agenda] = await Promise.all([
    loadVideoCollection(),
    loadShowModels(),
    loadPublicAgenda(),
  ]);

  return (
    <VideosProvider videos={videos}>
      <ExperienceProvider>
        <Loader />
        {/* data-experience-home: o que sai de cena quando uma subtela ("Ver mais") abre */}
        <Header agenda={agenda !== null} />
        <main data-experience-home>
          <Hero />
          <Marquee />
          <About />
          <Videos />
          <Music />
          {/* Só com a agenda habilitada no painel (null = desabilitada ou banco fora do ar). */}
          {agenda && <Agenda shows={agenda.shows} now={agenda.now} />}
          <Marquee />
          <Models />
          <Show models={showModels} />
          <Contact />
        </main>
      </ExperienceProvider>
    </VideosProvider>
  );
}
