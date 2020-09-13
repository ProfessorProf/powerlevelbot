module.exports = {
    OfferTypes: {
        Fight: 0,
        Fusion: 1,
        Recruit: 2,
        Taunt: 3,
        Confirmation: 4
    },
    Statuses: {
        Dead: 0,
        Training: 1,
        Ready: 2,
        Cooldown: 3,
        Annihilation: 4,
        TrainingComplete: 5,
        Name: {
            0: 'Defeated',
            1: 'Training',
            2: 'Ready',
            3: 'Cooldown',
            4: 'Annihilation',
            5: 'Training Complete',
        },
        Priority: {
            0: 600,
            1: 500,
            2: 400,
            3: 300,
            4: 200,
            5: 100,
        },
        Ends: {
            0: true,
            1: false,
            2: false,
            3: true,
            4: false,
            5: false
        }
    },
    Cooldowns: {
        Action: 0,
        Garden: 1,
        Challenge: 2,
        Name: {
            0: 'World Actions',
            1: 'Garden Actions',
            2: 'Issue Challenge'
        }
    },
    Configs: {
        AlwaysPrivate: 'AlwaysPrivate',
        Ping: 'Ping',
        Pronoun: 'Pronoun',
        AutoTrain: 'AutoTrain',
        Defaults: {
            AlwaysPrivate: false,
            Ping: false,
            Pronoun: 'they',
            AutoTrain: false
        },
        Type: {
            AlwaysPrivate: 'bool',
            Ping: 'bool',
            Pronoun: 'text',
            AutoTrain: 'bool'
        }
    },
    FightSummaries: {
        ExpectedWin: 0,
        UnexpectedWin: 1
    },
    ArcTypes: {
        Filler: 0,
        OrbHunt: 1,
        Tournament: 2,
        Nemesis: 3,
        DarkTournament: 4,
        Name: {
            0: 'Filler',
            1: 'Orb Hunt',
            2: 'Tournament',
            3: 'Nemesis',
            4: 'Dark Tournament'
        }
    },
    TrainingTypes: {
        Neutral: 0,
        Attack: 1,
        Defense: 2,
        Health: 3
    },
    Techniques: {
        Transform: 1,
        BurstAttack: 2,
        Rage: 3,
        Heal: 4,
        Name: {
            1: 'Transform',
            2: 'Burst Attack',
            3: 'Rage Mode',
            4: 'Healing'
        },
        Command: {
            1: '`!t transform` or `!t t`',
            2: '`!t burst` or `!t b`',
            3: '`!t rage` or `!t r`',
            4: '`!t heal` or `!t h`'
        }
    },
    BattleEffects: {
        AttackBoost: 1,
        DefenseBoost: 2
    }
}