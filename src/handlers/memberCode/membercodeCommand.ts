import {
    ApplicationCommandData,
    ChatInputCommandInteraction,
    Client,
    GuildMemberRoleManager,
    Interaction, InteractionContextType,
    MessageFlags,
    SlashCommandBuilder
} from "discord.js";
import {CommandHandler} from "../../DiscordHandler/DiscordHandler";
import {drizzle} from "drizzle-orm/node-postgres";
import * as schema from "../../db/schema";
import {eq, and} from "drizzle-orm";
import {NodePgDatabase} from "drizzle-orm/node-postgres/driver";
const appConfig = require('../../../msb.config')

export class MembercodeCommandHandler implements CommandHandler {

    command = new SlashCommandBuilder()
        .setName('membercode')
        .setDescription('Enter your member code and instantly get accepted as full makerspace member in discord')
        .setDescriptionLocalizations({
            "de": "Gib Deinen Mitgliedscode ein und erhalte sofort Zugriff auf den internen Bereich"
        })
        .setContexts([
            InteractionContextType.Guild
        ])
        .addStringOption(option =>
            option.setName('code')
                .setDescription('the code')
                .setRequired(true)
        ).toJSON() as ApplicationCommandData


    async run(client: Client, interaction: Interaction): Promise<void> {
        if (!interaction.isChatInputCommand()) return
        const command = new MembercodeCommand({interaction})
        await command
            .showUserThatWeAreProcessing()
            .validateIfAlreadyMember()
            .validateEnteredCode()
            .validateThatCodeExistsAndHasntBeenUsed()
            .assignMemberRole()
            .markCodeAsUsed()
            .informUserAboutSuccess()
            .informAboutErrors()
    }

    getName(): string {
        return this.command.name
    }
}

class ValidationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "ValidationError";
    }
}

class MembercodeCommand {
    private promise: Promise<any>;
    private interaction: ChatInputCommandInteraction;
    private db: NodePgDatabase<typeof import("../../db/schema")>;

    constructor({interaction}: { interaction: ChatInputCommandInteraction }) {
        this.interaction = interaction
        this.promise = Promise.resolve();
        this.db = drizzle(process.env.DATABASE_URL, {schema, logger: true});
    }

    showUserThatWeAreProcessing() : this {
        this.promise = this.promise.then(() => {
            return this.interaction.deferReply({flags: MessageFlags.Ephemeral})
        })
        return this
    }

    validateIfAlreadyMember() : this {
        this.promise = this.promise.then(() => {
            console.log("inside promise")
            if(this.interaction.member.roles instanceof GuildMemberRoleManager && this.interaction.member.roles.cache.has(appConfig.membercodes.roleId)) {
                throw new ValidationError('Du bist doch schon Mitglied. Hör auf rumzuspielen und bastel lieber was für den MakerSpacce.')
            }
        })
        return this
    }


    validateEnteredCode() : this {
        this.promise = this.promise.then(() => {
            const code = this.interaction.options.getString('code')
            let [code_part1, code_part2] = code.split("-")
            if ( parseInt(code_part2).toString() != code_part2) {
                throw new ValidationError(`Der Code **${code}** ist ungueltig.`)
            }
            return [code_part1, code_part2, code]
        })
        return this
    }

    informAboutErrors() {
        this.promise.catch((error: Error) => {
            if (error instanceof ValidationError) {
                this.interaction.editReply({content: error.message})
                return
            }
            this.interaction.editReply({content: "Ein Fehler ist aufgetreten. Sorry, keine Ahnung, was da passiert ist."})
            console.error(error)
        })

    }

    validateThatCodeExistsAndHasntBeenUsed() {
        this.promise = this.promise.then(async ([code_part1, code_part2, code]) => {
            console.log("1")
            const memberCode = await this.db.query.memberCodesTable.findFirst({where: (codes) =>
                and(
                    eq(codes.code, code_part1),
                    eq(codes.id, parseInt(code_part2)),
                    eq(codes.guildId, this.interaction.guild.id)
                )
            })
            console.log("2")
            if (!memberCode || memberCode.code != code_part1) {
                throw new ValidationError(`Den Code **${code}** haben wir leider nicht gefunden.`);
            }

            if(memberCode.userId) {
                throw new ValidationError(`Der Code **${code}** wurde bereits verwendet.`);
            }
            return memberCode

        })
        return this
    }

    markCodeAsUsed() {
        this.promise = this.promise.then(async (memberCode) => {
            const x = await this.db.update(schema.memberCodesTable)
                .set({userId: this.interaction.user.id, usedAt: new Date()})
                .where(eq(schema.memberCodesTable.id, parseInt(memberCode.id)))
            console.log(x)
        })
        return this
    }

    assignMemberRole() {
        this.promise = this.promise.then(async (memberCode) => {
            try {
                await this.interaction.guild.members.cache.get(this.interaction.user.id).roles.add(appConfig.membercodes.roleId)
            } catch (e) {
                console.error(e)
                throw new ValidationError(`Sorry, ich darf Dich gar nicht freischalten. Vielleicht erlaubt mir das ja irgendwann jemand. solange sprich doch einfach <@689378839478009856> oder <@660471943866220544> an.`)
            }
            return memberCode
        })
        return this
    }

    informUserAboutSuccess() {
        this.promise = this.promise.then(() => {
            this.interaction.editReply({content: `**Willkommen im Mitgliederbereich, <@${this.interaction.user.id}>!**\nAb nun solltest Du den internen Bereich mit allen Kanälen sehen können, wie zum Beispiel <#${appConfig.membercodes.exampleInternalChannelId}>. \nWeitere Infos schicke ich Dir per DM.`});
        })
        return this
    }
}
