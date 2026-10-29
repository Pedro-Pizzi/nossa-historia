import "server-only";
import { redirect } from "next/navigation";
import { currentAccount } from "@/lib/auth/server";
import { getDatabase } from "@/lib/database/server";
import { readBook } from "@/lib/database/book";
import { UserSession,AccountMenu } from "@/features/auth/components/user-session";
import { LegacyImport } from "@/features/import/components/legacy-import";
import { StoryExperience } from "../components/story-experience";
import { BookChapter } from "./book-chapter";
import { MomentGallery } from "@/features/memories/components/moment-gallery";
import { BookNotebook } from "@/features/journal/components/book-notebook";
import { QuestionsNotebook } from "@/features/questions/components/questions-notebook";
import { LetterBox } from "@/features/letters/components/letter-box";
import { DateIdeas } from "@/features/dates/components/date-ideas";
import { MemoryNotebook } from "@/features/shared/memory-notebook";
import { Recollections } from "@/features/recollections/components/recollections";

export async function StoryPage() {
 const account=await currentAccount();if(!account)redirect("/login");
 const book=await readBook(await getDatabase());
 const user={id:account.id,name:account.name};
 if(!book)return <UserSession user={user}><main className="auth-screen"><article className="auth-card"><AccountMenu/><h1>Preparando nossa história</h1><p>O conteúdo inicial ainda precisa ser importado para o banco. Os acessos já estão protegidos.</p></article></main></UserSession>;
 const {catalog,chapters}=book;
 return <>
  {Array.from({length:9},(_,index)=><link key={index} rel="stylesheet" href={`/acervo/styles/style-${String(index+1).padStart(2,"0")}.css`} precedence={`story-${index}`}/>)}
  <UserSession user={user}><StoryExperience cover={<BookChapter tree={chapters.opening}/>}>
   <LegacyImport/>
   <BookChapter tree={chapters.carta}/>
   <BookChapter tree={chapters.memorias}><MomentGallery/></BookChapter>
   <BookChapter tree={chapters.diario}><BookNotebook kind="day" icons={catalog.bookIcons}/></BookChapter>
   <BookChapter tree={chapters.perguntas}><QuestionsNotebook sections={catalog.questionSections} heartIntro={catalog.heartIntro}/></BookChapter>
   <BookChapter tree={chapters.sonhos}><BookNotebook kind="dreams" icons={catalog.bookIcons}/></BookChapter>
   <BookChapter tree={chapters.biblioteca}><BookNotebook kind="favorites" icons={catalog.bookIcons} favoriteIcons={catalog.favoriteIcons}/></BookChapter>
   <BookChapter tree={chapters.acolhimento}><LetterBox/></BookChapter>
   <BookChapter tree={chapters.encontros}><DateIdeas ideas={catalog.challenges}/></BookChapter>
   <BookChapter tree={chapters.escolha}><MemoryNotebook kind="choice"/></BookChapter>
   <BookChapter tree={chapters.marcos}><MemoryNotebook kind="milestone"/></BookChapter>
   <BookChapter tree={chapters.checkin}><MemoryNotebook kind="checkin"/></BookChapter>
   <BookChapter tree={chapters.lembrar}><Recollections/></BookChapter>
   <BookChapter tree={chapters["neste-dia"]}><Recollections onThisDay/></BookChapter>
   <BookChapter tree={chapters.final}/>
  </StoryExperience></UserSession>
 </>;
}
