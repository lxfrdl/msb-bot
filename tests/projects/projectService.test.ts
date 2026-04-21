import {ProjectService} from "../../src/handlers/projects/services/projectService";
import {drizzle} from "drizzle-orm/node-postgres";
import * as schema from "../../src/db/schema";
import {projectsTable} from "../../src/db/schema";
import {eq} from "drizzle-orm";
const db = drizzle(process.env.DATABASE_URL, {schema, logger: true});

describe("project services", () => {
    beforeAll(async () => {
        await db.delete(projectsTable).where(eq(projectsTable.guildId, "1"));
        await db.delete(projectsTable).where(eq(projectsTable.guildId, "2"));
        await db.insert(projectsTable).values([
            {name: "Testprojekt", guildId: "1", description: "Testprojekt", leaderId: "leader1", people: ["person1"], createdAt: new Date(), doneAt: new Date()},
            {name: "Testprojekt - active", guildId: "1", description: "Testprojekt active", leaderId: "leader1", people: ["person1"], createdAt: new Date()},
            {name: "Testprojekt - another guild", guildId: "2", description: "Testprojekt", leaderId: "leader1", people: ["person1"], createdAt: new Date(), doneAt: new Date()},
        ]);
    })

    test("read projects", async () => {
        const projectService = new ProjectService("1")
        const projects = await projectService.getProjects()
        expect(projects).toBeInstanceOf(Array)
        //console.log( projects)
        expect(projects.length).toBe(2)
        expect(projects[0].name).toBe("Testprojekt")
    })

    test("read active projects", async () => {
        const projectService = new ProjectService("1")
        const projects = await projectService.getActiveProjects()
        expect(projects).toBeInstanceOf(Array)
        //console.log( projects)
        expect(projects.length).toBe(1)
    })

    test("add project", async () => {
        const projectService = new ProjectService("1")
        const projects = await projectService.getProjects()
        expect(projects.length).toBe(2)
        await projectService.addProject({name: "added Project", description: "Testprojekt", leaderId: "leader1", guildId: "1", people: ["person2"], createdAt: new Date()})
        const projects2 = await projectService.getProjects()
        expect(projects2.length).toBe(3)
    })


})