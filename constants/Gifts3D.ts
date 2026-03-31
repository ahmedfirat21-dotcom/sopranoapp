// constants/Gifts3D.ts
// Merkezi 3D Hediye Kayıt Sistemi (Registry)
// 
// Yeni bir 3D model eklemek için tek yapmanız gereken:
// 1. '.glb' modelini "assets/models/" içine atın.
// 2. '.png' görselini "assets/images/gifts/" içine atın.
// 3. Aşağıdaki listeye yeni bir obje (örneğin 'yeni_model') ekleyin.
// UI (Hediye Menüsü) ve 3D Motor otomatik olarak kalanı halledecektir.

export const PREMIUM_3D_GIFTS: Record<string, {
  name: string;
  price: number;
  modelSrc: any;
  imageSrc?: any;
  scale: number;
  yOffset: number;
}> = {
  sportscar: {
    name: 'Spor Araba',
    price: 1500,
    modelSrc: require('../assets/models/disco_ball.glb'),
    scale: 0.8,
    yOffset: -2
  },
  planet: {
    name: 'Gezegen',
    price: 2500,
    modelSrc: require('../assets/models/disco_ball.glb'),
    scale: 1.5,
    yOffset: 0
  },
  dragon: {
    name: 'Kadim Ejderha',
    price: 7500,
    modelSrc: require('../assets/models/disco_ball.glb'),
    imageSrc: require('../assets/images/gifts/dragon.png'),
    scale: 1.2,
    yOffset: -1.5
  }
};
