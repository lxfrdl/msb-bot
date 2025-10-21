import {
    ApplicationCommandData, AttachmentBuilder,
    Client,
    Interaction,
    InteractionContextType,
    MessageFlags,
    SlashCommandBuilder
} from "discord.js";
import {CommandHandler} from "../../DiscordHandler/DiscordHandler";
import {ProjectService} from "./services/projectService";

export class GenerateCodesCommandHandler implements CommandHandler {

    command = new SlashCommandBuilder()
        .setName("listprojects")
        .setDescription("list")

        .setContexts([
            InteractionContextType.Guild
        ])
        .toJSON() as ApplicationCommandData

    async execute({ interaction, config, logger }) {
        if (!interaction.isChatInputCommand()) return
        try {
            await interaction.deferReply({flags: MessageFlags.Ephemeral})
            const projectService = new ProjectService(interaction.guild.id)
            const projects = await projectService.getActiveProjects()
            if (projects.length === 0) {
                await interaction.editReply({
                    content: "No active projects",
                });
                return
            }
            const projectText = `List of active projects: \n${projects.map((project) => project.name).join("\n")}`
            const projectList = projects.map((project) => `**${project.name}**\n${project.description}`).join("\n---------\n")

            await interaction.editReply({
                content: projectList,
            });
        } catch (e) {
            logger.error(e)
            await interaction.editReply({
                content: 'Something went wrong, sorry.',
            });
        }

    }

    async run(client: Client, interaction: Interaction): Promise<void> {
        console.log("colled the wrong listunusedcodes command handler")
    }

    getName(): string {
        return this.command.name
    }

    private generateVoucherCode(): string {
        const characters = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
        const length = 6;
        let voucherCode = '';

        for (let i = 0; i < length; i++) {
            const randomIndex = Math.floor(Math.random() * characters.length);
            voucherCode += characters[randomIndex];
        }

        return voucherCode;
    }
}
