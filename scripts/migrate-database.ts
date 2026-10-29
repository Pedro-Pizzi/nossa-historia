import { loadDatabaseEnvironment } from "./database-environment";
import { createDatabase } from "../src/lib/database/client";
import { migrate } from "../src/lib/database/migrate";
async function main(){const db=await createDatabase(loadDatabaseEnvironment());try{await migrate(db);console.log("Migrações aplicadas. Os registros existentes foram preservados.");}finally{await db.close();}}
main().catch(()=>{console.error("Não foi possível aplicar as migrações. Confira a configuração do banco.");process.exitCode=1;});
