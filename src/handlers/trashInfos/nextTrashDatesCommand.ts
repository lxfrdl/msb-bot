import {
    ApplicationCommandData,
    Interaction,
    SlashCommandBuilder
} from "discord.js";
import {CommandHandler, DiscordHandler} from "../../DiscordHandler/DiscordHandler";
import {TrashService} from "../../Services/TrashService";

export class NextTrashDatesCommandHandler implements CommandHandler {

    command = new SlashCommandBuilder()
        .setName('muell')
        .setDescription('Gives the next trash dates.')
        .setDescriptionLocalizations({
            "de": "Nennt die nächsten Mülltermine."
        })
        .toJSON() as ApplicationCommandData

    async execute ({ interaction, trashService } : { interaction: Interaction, trashService: TrashService }) {
        if (!interaction.isChatInputCommand()) return
        console.log("colled the right trash handler")
        const x = await trashService.getNextTrashDates()
        let message: string = "die nächsten Termine sind: \n"
        x.forEach(trashDate => {
            message += `${trashDate.timeString()} - ${trashDate.type}\n`
        })

        interaction.reply({
            content: message
        });
    }

    getName(): string {
        return this.command.name
    }
}
