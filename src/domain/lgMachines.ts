export const LG_MACHINES = [
  {
    key: 'maq_753', codigo: '753', nomeDefault: 'Lavadora 753',
    deviceId: 'a62b1df203c4a7188e7880433c9cebfb407c428b5a5a8e0af9dd0f696bee44c1',
    capacidadeKg: 14, capacidadeSecagemKg: 8,
  },
  {
    key: 'maq_789', codigo: '789', nomeDefault: 'Lavadora 789',
    deviceId: '2d6ec2ccc498b22ed9690f16cec2b0d93a0743abb5c3c2c594ecd6bcc1779181',
    capacidadeKg: 14, capacidadeSecagemKg: 8,
  },
  {
    key: 'maq_393', codigo: '393', nomeDefault: 'Lava e Seca 393 (16 kg)',
    deviceId: '912f1fb0c10ef28541d04efa0533edf5d8528b38af00f2429a3e8366921d7b5e',
    capacidadeKg: 16, capacidadeSecagemKg: null,
  },
  {
    key: 'maq_177', codigo: '177', nomeDefault: 'Lava e Seca 177 (16 kg)',
    deviceId: '416c359d858c6cbfc37c79ccab164208b06147bbe50bf61a8f6c8398b5f109ce',
    capacidadeKg: 16, capacidadeSecagemKg: null,
  },
] as const

export type LgMachineKey = typeof LG_MACHINES[number]['key']
