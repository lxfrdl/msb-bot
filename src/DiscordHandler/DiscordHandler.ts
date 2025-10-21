import {
    ApplicationCommand, ApplicationCommandData,
    Client,
    GuildMember, Interaction, Message, Presence,
    REST,
    Routes,
} from "discord.js";
import { Events } from "discord.js";
import {ActionLoader} from "./ActionLoader";
import {ContextAppendType, DiscordEventMap, EventContext, Reconcile} from "./types";
import {BaseLogger} from "pino";
import spaceStateInfo from "../handlers/spaceState/SpaceStateInfo";

export interface DiscordHandlerOptions {
    client: Client,
    handlerPath: string,
    registerCommands?: boolean,
    config?: object,
    logger?: BaseLogger
}

export interface Config  {
    spaceStateInfo?: object
}



export class DiscordHandler<Decorators = {}> {
    private useHandlers: ((ctx: Decorators) => void)[] = [];
    private services: any;
    private client: Client;
    private actionLoader: ActionLoader;
    private options: DiscordHandlerOptions
    readonly commands: Map<string, CommandHandler> = new Map();
    readonly events: Map<string, EventHandler> = new Map();
    private rest: REST
    private logger?: BaseLogger;
    private config: object;

    constructor (
        options: DiscordHandlerOptions,
        private decorators: Decorators = {} as Decorators
    )  {
        this.logger = options.logger
        this.decorators = decorators
        this.logger?.debug("this.decorators %o", this.decorators)
        this.services = []
        this.options = options
        this.client = options.client
        this.actionLoader = new ActionLoader({
            path: options.handlerPath,
            logger: options.logger
        })
        this.options.registerCommands = options.registerCommands || false
        this.rest = new REST().setToken(process.env.DISCORD_BOT_TOKEN);
        this.config = options.config
        this.registerActions()

    }

    private eventHandlers: {
        [E in keyof DiscordEventMap]?: Array<
            (ctx: Decorators & EventContext<E>) => void
        >
    } = {};

    on<E extends keyof DiscordEventMap>(
        event: E,
        handler: (ctx: Decorators & EventContext<E>) => void
    ): this {
        if (!this.eventHandlers[event]) {
            this.eventHandlers[event] = [];
        }
        this.eventHandlers[event]!.push(handler);

        // Register the Discord.js event if not already done
        if (!this.client.listenerCount(event)) {
            this.client.on(event, (...args: DiscordEventMap[E]) => {
                this.handleEvent(event, args);
            });
        }

        return this;
    }

    private handleEvent<E extends keyof DiscordEventMap>(
        event: E,
        args: DiscordEventMap[E]
    ) {
        const handlers = this.eventHandlers[event];
        if (handlers) {
            const eventContext: EventContext<E> = { event, args };
            const fullContext = { ...this.decorators, ...eventContext };

            for (const handler of handlers) {
                handler(fullContext as Decorators & EventContext<E>);
            }
        }
    }

    decorate<Name extends string, Value>(
        name: Name,
        value: Value
    ): DiscordHandler<Reconcile<Decorators, { [K in Name]: Value }>>;

    decorate<NewDecorators extends Record<string, unknown>>(
        decorators: NewDecorators
    ): DiscordHandler<Reconcile<Decorators, NewDecorators>>;

    decorate<
        NewDecorators extends Record<string, unknown>,
        Type extends ContextAppendType = 'append'
    >(
        options: { as: Type },
        decorators: NewDecorators
    ): DiscordHandler<Reconcile<Decorators, NewDecorators, Type extends 'override' ? true : false>>;

    decorate<
        Name extends string,
        Value,
        Type extends ContextAppendType = 'append'
    >(
        options: { as: Type },
        name: Name,
        value: Value
    ): DiscordHandler<Reconcile<Decorators, { [K in Name]: Value }, Type extends 'override' ? true : false>>;

    decorate(...args: any[]): DiscordHandler<any> {
        let decorators: Record<string, unknown> = {};
        let override = false;

        if (args.length === 1 && typeof args[0] === 'object') {
            decorators = args[0];
        } else if (
            args.length === 2 &&
            typeof args[0] === 'string'
        ) {
            decorators = {[args[0]]: args[1]};
        } else if (
            args.length === 2 &&
            typeof args[0] === 'object' &&
            'as' in args[0]
        ) {
            decorators = args[1];
            override = args[0].as === 'override';
        } else if (
            args.length === 3 &&
            typeof args[0] === 'object' &&
            'as' in args[0] &&
            typeof args[1] === 'string'
        ) {
            decorators = {[args[1]]: args[2]};
            override = args[0].as === 'override';
        }

        const newDecorators = mergeDeep(this.decorators, decorators, override);
        return new DiscordHandler(this.options, newDecorators)._copyHandlers(this.useHandlers);
    }

    private _copyHandlers(handlers: ((ctx: any) => void)[]) {
        this.useHandlers = [...handlers];
        return this;
    }

    executeHandlers() {
        this.logger.info('🚀 Running app with context:');
        this.logger.info(this.decorators);
        for (const handler of this.useHandlers) {
            handler(this.decorators);
        }
    }

    use(handler: (ctx: Decorators) => void) {
        this.useHandlers.push(handler);
        return this;
    }

    private registerActions() {
        const actions = this.actionLoader.load()
        actions.forEach((action: any) => {
            if (action.eventType) {
                if (typeof action.execute === 'function' && action.execute ) {
                    let args = {}
                    this.logger.trace("registering event %o on %s", action.eventType.toString(), action.constructor.name)
                    this.client.on(action.eventType.toString(), (...args) => {
                        action.execute(args, {client: this.client, logger: this.logger, discordHandler: this, ...this.services})
                    })
                } else {
                    this.logger.trace("registering event %o on %s", action.eventType.toString(), action.constructor.name)
                    this.client.on(action.eventType.toString(), action.run.bind(this, this.client, this))
                }
                this.events.set(action.getName(), action)
            } else if (action.command) {
                //this.client.on('interactionCreate', action.run.bind(this, this.client, this))
                this.commands.set(action.command.name, action)
            }


        })
        this.client.on('interactionCreate', async interaction => {
            if (interaction.isCommand()) {
                const command = this.commands.get(interaction.commandName);
                try {
                    if (typeof command.execute === 'function' && command.execute ) {
                        this.logger.debug("executing command %o", command.command.name)
                        command.execute({interaction, client: this.client, discordHandler: this, ...this.services});
                    } else {
                        command.run(this.client, interaction, this);
                    }
                } catch (error) {
                    console.error(`ERROR running {interaction.commandName}`, error);
                }
            }
        });
        this.refreshCommands()


    }

    async refreshCommands() {
        if (this.options.registerCommands === false) {
            this.logger.info("skipping command registration")
            return
        }
        const guildId = this.config.guildId;
        try {
            this.logger.info(
        `Started refreshing ${this.commands.size} application (/) commands for guild ${guildId}.`,
            );

            const commandJson : ApplicationCommandData[]= this.commands.values().map((value, index) => value.command).toArray()

            const data: ApplicationCommand[] = await this.rest.put(
                Routes.applicationGuildCommands(process.env.DISCORD_CLIENT_ID, guildId),
                {body: commandJson },
            ) as ApplicationCommand[];

            this.logger.info(`Successfully reloaded ${data.length} application (/) commands.`);
        } catch (error) {
            // And of course, make sure you catch and log any errors!
            this.logger.error("ERROR %o", error);
        }
    }



    addService(name: string, service: any) {
        this.services[name] = service;
    }

    service(name: string) {
        return this.services[name] || null
    }

    isEvent(eventName: string) {
        return Object.values(Events).includes(eventName as Events);
    }
}

export interface ActionHandler {
    getName(): string;
}

export interface CommandHandler extends ActionHandler {
    commandJson?: () =>object
    command: ApplicationCommandData
    execute?: (...args: any[]) => void
    run?: (...args: any[]) => void
}

export interface EventHandler extends ActionHandler {
    eventType: Events
    run?: (...args: any[]) => void
    execute?: (...args: any[]) => void
}

export interface ClientReadyHandler extends EventHandler {
    eventType: Events
    run?: (client: Client, handler: DiscordHandler) => void
}

export interface GuildMemberAddHandler extends EventHandler {
    eventType: Events
    run?: (client: Client, handler: DiscordHandler, newMember: GuildMember) => void
}

export interface GuildMemberUpdateHandler extends EventHandler {
    eventType: Events.GuildMemberUpdate
    run?: (client: Client, handler: DiscordHandler, oldMember: GuildMember, newMember: GuildMember) => void
}

export interface PresenceUpdateHandler extends EventHandler {
    eventType: Events.PresenceUpdate
    run?: (client: Client, handler: DiscordHandler, oldPresence: Presence, newPresence: Presence) => void
}

export interface InteractionCreateHandler extends EventHandler {
    eventType: Events.InteractionCreate
    run?: (client: Client, handler: DiscordHandler, interaction: Interaction) => void
}

export interface MessageCreateHandler extends EventHandler {
    eventType: Events.MessageCreate
    run?: (client: Client, handler: DiscordHandler, message: Message) => void
    execute?: (
        [message]: [message: Message],
        { client, handler }: { client: Client<true>; handler: DiscordHandler }
    ) => Promise<void> | void
}


function mergeDeep<T, U>(
    target: T,
    source: U,
    override = false
): Reconcile<T, U> {
    const result: any = { ...target };

    for (const key in source) {
        const srcVal = (source as any)[key];
        const tgtVal = (target as any)[key];

        if (
            !override &&
            typeof srcVal === 'object' &&
            typeof tgtVal === 'object' &&
            srcVal !== null &&
            tgtVal !== null
        ) {
            result[key] = mergeDeep(tgtVal, srcVal, override);
        } else {
            result[key] = srcVal;
        }
    }

    return result;
}


