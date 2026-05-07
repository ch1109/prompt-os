import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/db";

export const useScenarios = () => useLiveQuery(() => db.scenarios.toArray()) ?? [];
