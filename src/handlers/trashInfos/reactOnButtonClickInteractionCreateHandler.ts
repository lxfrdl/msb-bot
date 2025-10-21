import {ButtonInteraction, Client, Events, Interaction} from "discord.js";
import {ClientReadyHandler, DiscordHandler, InteractionCreateHandler} from "../../DiscordHandler/DiscordHandler";
import {TrashDiscordService} from "../../Services/trashDiscordService";

class ButtonHandler implements InteractionCreateHandler {
    eventType: Events.InteractionCreate = Events.InteractionCreate
    run(client: Client, handler: DiscordHandler) {
        console.log("ready called")
    }
    execute([interaction]: [ButtonInteraction], {trashDiscordService} : {trashDiscordService: TrashDiscordService}) {
        trashDiscordService.handleButtonClick(interaction)
    }
    getName(): string {
        return "some test ready handler"
    }

}

export default ButtonHandler