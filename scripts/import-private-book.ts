import { privateBookFiles } from "./private-book-files";
import { createDatabase } from "../src/lib/database/client";
import { importBook } from "../src/lib/database/book";
import { migrate } from "../src/lib/database/migrate";
import { loadDatabaseEnvironment } from "./database-environment";
async function main(){const data=await privateBookFiles();if(!data)throw Error("Pacote privado ausente.");const db=await createDatabase(loadDatabaseEnvironment());try{await migrate(db);console.log("Importação privada concluída:",await importBook(db,data.book,data.assets));}finally{await db.close();}}
main().catch(()=>{console.error("Não foi possível importar o livro. Confira o pacote privado e a conexão. Nenhum conteúdo diferente já existente será substituído.");process.exitCode=1;});
