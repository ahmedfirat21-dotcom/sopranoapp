import React, { useRef, useMemo, Suspense } from 'react';
import { View, StyleSheet, Dimensions, Platform, Text } from 'react-native';
import { Canvas, useFrame } from '@react-three/fiber/native';
import { useGLTF } from '@react-three/drei/native';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import * as THREE from 'three';
import { QueuedGift } from './GiftAnimationQueue';
import { PREMIUM_3D_GIFTS } from '../constants/Gifts3D';
import { useAssets } from 'expo-asset';
const { width: W, height: H } = Dimensions.get('window');

// ==========================================
// 1. UÇAN KALPLER FIRTINASI (HeartStorm)
// ==========================================
const HeartShape = () => {
  const shape = useMemo(() => {
    const s = new THREE.Shape();
    const x = 0, y = 0;
    s.moveTo(x + 5, y + 5);
    s.bezierCurveTo(x + 5, y + 5, x + 4, y, x, y);
    s.bezierCurveTo(x - 6, y, x - 6, y + 7, x - 6, y + 7);
    s.bezierCurveTo(x - 6, y + 11, x - 3, y + 15.4, x + 5, y + 19);
    s.bezierCurveTo(x + 12, y + 15.4, x + 16, y + 11, x + 16, y + 7);
    s.bezierCurveTo(x + 16, y + 7, x + 16, y, x + 10, y);
    s.bezierCurveTo(x + 7, y, x + 5, y + 5, x + 5, y + 5);
    return s;
  }, []);
  return <shapeGeometry args={[shape]} />;
};

const HeartStorm = ({ onComplete }: { onComplete: () => void }) => {
  const count = 60;
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const time = useRef(0);
  
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const particles = useMemo(() => {
    return new Array(count).fill(0).map((_, i) => ({
      angle: Math.random() * Math.PI * 2,
      radius: 2 + Math.random() * 4,
      speedY: 3 + Math.random() * 4,
      speedRot: (Math.random() - 0.5) * 5,
      yOffset: -10 - Math.random() * 10,
      scale: 0.05 + Math.random() * 0.1
    }));
  }, []);

  useFrame((state, delta) => {
    time.current += delta;
    if (time.current > 4) {
      onComplete(); // 4 saniye sürer
      return;
    }
    
    if (meshRef.current) {
      particles.forEach((p, i) => {
        const py = p.yOffset + time.current * p.speedY; // yukarı çıkış
        const px = Math.cos(p.angle + time.current * 2) * p.radius;
        const pz = Math.sin(p.angle + time.current * 2) * p.radius;
        
        dummy.position.set(px, py, pz);
        // Kalbin etrafında dönmesi için
        dummy.rotation.set(Math.PI, 0, p.speedRot * time.current); 
        dummy.scale.setScalar(p.scale);
        dummy.updateMatrix();
        meshRef.current!.setMatrixAt(i, dummy.matrix);
      });
      meshRef.current.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]}>
      <HeartShape />
      <meshStandardMaterial 
        color="#ff1493" 
        emissive="#ff1493" 
        emissiveIntensity={2} 
        side={THREE.DoubleSide} 
        transparent 
        opacity={0.8}
      />
    </instancedMesh>
  );
};

// ==========================================
// 2. ALTIN TAÇ PATLAMASI (GoldCrown)
// ==========================================
const GoldCrown = ({ onComplete }: { onComplete: () => void }) => {
  const groupRef = useRef<THREE.Group>(null);
  const time = useRef(0);

  useFrame((_, delta) => {
    time.current += delta;
    if (time.current > 3.5) {
      onComplete();
      return;
    }

    if (groupRef.current) {
      // Intro Scale animasyonu
      const scale = Math.min(1.5, time.current * 4); // hizli buyume
      // Salinim (Floating) animasyonu
      const hoverY = Math.sin(time.current * 3) * 0.5;
      
      groupRef.current.scale.setScalar(scale);
      groupRef.current.position.y = hoverY;
      // Kendi etrafinda dönme
      groupRef.current.rotation.y = time.current * 1.5;
    }
  });

  // Crown parçaları - Procedural
  return (
    <group ref={groupRef}>
      {/* Taç gövdesi */}
      <mesh position={[0, -1, 0]}>
        <cylinderGeometry args={[2, 1.5, 2, 8, 1, true]} />
        <meshStandardMaterial color="#FFD700" metalness={1} roughness={0.1} emissive="#FFD700" emissiveIntensity={0.5} side={THREE.DoubleSide} />
      </mesh>
      {/* Taçın alt halkası */}
      <mesh position={[0, -2, 0]} rotation={[Math.PI/2, 0, 0]}>
        <torusGeometry args={[1.6, 0.4, 16, 32]} />
        <meshStandardMaterial color="#FFD700" metalness={1} roughness={0.2} emissive="#FFA500" emissiveIntensity={0.8} />
      </mesh>
      {/* Taçın üst sivri uçlarındaki elmaslar */}
      {[0, 1, 2, 3, 4, 5, 6, 7].map(i => {
        const angle = (i / 8) * Math.PI * 2;
        const x = Math.cos(angle) * 2;
        const z = Math.sin(angle) * 2;
        return (
          <mesh key={i} position={[x, 0, z]}>
            <octahedronGeometry args={[0.4]} />
            <meshStandardMaterial color="#00ffff" metalness={0.9} roughness={0.1} emissive="#00ffff" emissiveIntensity={2} />
          </mesh>
        )
      })}
    </group>
  );
};

// ==========================================
// 3. LÜKS ROKET (LuxuryRocket)
// ==========================================
const LuxuryRocket = ({ onComplete }: { onComplete: () => void }) => {
  const groupRef = useRef<THREE.Group>(null);
  const fireRef = useRef<THREE.Points>(null);
  const time = useRef(0);

  const particleCount = 200;
  const positions = useMemo(() => new Float32Array(particleCount * 3), []);

  useFrame((_, delta) => {
    time.current += delta;
    if (time.current > 4.5) {
      onComplete();
      return;
    }

    if (groupRef.current) {
      // Asagidan yukari ucma: start Y = -15, end Y = 15
      // 0-1s arası hızlanarak merkeze gelme, 1-3s arası merkezde yavaşlama, 3-4s gidiş
      let y = -15;
      if (time.current < 1) {
        y = -15 + (time.current * 15); // hizli giris
      } else if (time.current < 3) {
        y = 0 + (time.current - 1) * 2; // yavas asili kalis
      } else {
        y = 4 + (time.current - 3) * 20; // hizli cikis
      }
      groupRef.current.position.set(0, y, 0);
      groupRef.current.rotation.z = Math.sin(time.current * 10) * 0.05; // Titreme efekti
    }

    if (fireRef.current) {
      const positionsAttr = fireRef.current.geometry.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < particleCount; i++) {
        let py = positionsAttr.getY(i) - (delta * 10); // ates asagi duser
        if (py < -5) {
          py = -1; // yeniden dogus
          positionsAttr.setX(i, (Math.random() - 0.5) * 2);
          positionsAttr.setZ(i, (Math.random() - 0.5) * 2);
        }
        positionsAttr.setY(i, py);
      }
      positionsAttr.needsUpdate = true;
    }
  });

  return (
    <group ref={groupRef}>
      {/* Roket Gövdesi */}
      <mesh position={[0, 0, 0]}>
        <cylinderGeometry args={[1, 1, 4, 32]} />
        <meshStandardMaterial color="#ffffff" metalness={0.8} roughness={0.2} />
      </mesh>
      {/* Roket Ucu */}
      <mesh position={[0, 3, 0]}>
        <coneGeometry args={[1, 2, 32]} />
        <meshStandardMaterial color="#ff0000" metalness={0.5} roughness={0.5} emissive="#aa0000" />
      </mesh>
      {/* Roket Kanatları */}
      <mesh position={[1, -1.5, 0]} rotation={[0, 0, -0.5]}>
        <boxGeometry args={[1.5, 2, 0.2]} />
        <meshStandardMaterial color="#ff0000" metalness={0.5} />
      </mesh>
      <mesh position={[-1, -1.5, 0]} rotation={[0, 0, 0.5]}>
        <boxGeometry args={[1.5, 2, 0.2]} />
        <meshStandardMaterial color="#ff0000" metalness={0.5} />
      </mesh>
      
      {/* Roket Ateşi (Particle Trail) */}
      <points ref={fireRef} position={[0, -2.5, 0]}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" array={positions} itemSize={3} count={particleCount} />
        </bufferGeometry>
        <pointsMaterial size={0.3} color="#ffa500" transparent opacity={0.8} />
      </points>
      {/* Işık kaynağı roketin altında */}
      <pointLight position={[0, -3, 0]} color="#ff4500" intensity={10} distance={10} />
    </group>
  );
};

// ==========================================
// 4. DIŞARIDAN YÜKLENEN .GLB OBJESİ (ExternalGLBGift)
// ==========================================
const ExternalGLBGift = ({ giftId, onComplete }: { giftId: string, onComplete: () => void }) => {
  const giftConfig = PREMIUM_3D_GIFTS[giftId];
  if (!giftConfig || !giftConfig.modelSrc) {
    onComplete();
    return null;
  }
  
  // Asenkron model yükleyici
  const gltf = useGLTF(giftConfig.modelSrc) as any;
  const { scene } = gltf;
  const clonedScene = useMemo(() => scene.clone(true), [scene]);
  
  const groupRef = useRef<THREE.Group>(null);
  const time = useRef(0);

  // Disko topu ve metalik objelerin "parlak beyaz alev topuna" dönüşmemesi için materyal düzeltmesi
  useMemo(() => {
    clonedScene.traverse((child: any) => {
      if ((child as THREE.Mesh).isMesh) {
         const mesh = child as THREE.Mesh;
         // Eğer model kendinden parlıyorsa (emissive) bunu kapatıyoruz ki kaplama (texture) görünsün
         if (mesh.material) {
           if ('emissiveIntensity' in mesh.material) {
             (mesh.material as any).emissiveIntensity = 0;
           }
           if ('roughness' in mesh.material) {
             (mesh.material as any).roughness = 0.2; // Cam gibi yansıtıcı
           }
           if ('metalness' in mesh.material) {
             (mesh.material as any).metalness = 0.8; // Metalik görünüm
           }
         }
      }
    });
  }, [clonedScene]);

  useFrame((_, delta) => {
    time.current += delta;
    if (time.current > 6.0) { // Daha uzun süre kalsın (6 saniye)
      onComplete();
      return;
    }
    
    // Küçük boyuttan yavaşça ekrana yerleşme ve kendi ekseninde dönme animasyonu
    if (groupRef.current) {
      // Scale: Sıfırdan başla, 1.5 saniyede hedef boyuta (3.0) ulaş ve sabitlen
      const targetScale = giftConfig.scale * 2.5;
      const currentScale = Math.min(time.current * 2.0 * giftConfig.scale, targetScale); 
      groupRef.current.scale.set(currentScale, currentScale, currentScale);

      // Position: Aşağıdan (-4) başla, yavaşça 0 (merkez) noktasına gel ve dur
      const currentY = Math.min(-4 + (time.current * 3.0), giftConfig.yOffset);
      groupRef.current.position.set(0, currentY, 0);

      // Rotation: Kendi ekseni etrafında aralıksız dönsün
      groupRef.current.rotation.y = time.current * 1.5;
    }
  });

  return (
    <group ref={groupRef}>
      {/* Orijinal renkleri ve dinamik ölçeklemeyi kullanan model */}
      <primitive object={clonedScene} />
      
      {/* Disko Topu aynalarından yansıması için sahte Stüdyo Işıkları (Env Map Alternatifi) */}
      <pointLight position={[3, 2, 3]} color="#ff00a0" intensity={15} distance={20} />
      <pointLight position={[-3, -1, 3]} color="#00e5ff" intensity={15} distance={20} />
      <pointLight position={[0, 4, -2]} color="#ffaa00" intensity={10} distance={20} />
    </group>
  );
};

// ==========================================
// 5. EFSANEVİ KARADELİK GİRDABI (BlackHoleVortex)
// ==========================================
const BlackHoleVortexGift = ({ onComplete }: { onComplete: () => void }) => {
  const [assets] = useAssets([require('../assets/models/disco_ball.glb')]);
  if (!assets || !assets[0]) return null;
  return <BlackHoleVortexRenderer uri={assets[0].localUri || assets[0].uri} onComplete={onComplete} />;
};

function BlackHoleVortexRenderer({ uri, onComplete }: { uri: string, onComplete: () => void }) {
  const gltf = useGLTF(uri) as any;
  const scene = gltf.scene;
  const clonedScene = useMemo(() => scene.clone(true), [scene]);
  const modelRef = useRef<THREE.Group>(null);
  const time = useRef(0);

  useMemo(() => {
    clonedScene.traverse((child: any) => {
      if (child.isMesh) {
        const name = child.name.toLowerCase();
        if (name.includes('sphere') || name.includes('hole') || name.includes('horizon')) {
           child.visible = false;
        } else if (child.material && child.material.color && child.material.color.clone().getHexString() === '000000') {
           child.visible = false;
        }
      }
    });
  }, [clonedScene]);

  useFrame((state, delta) => {
    time.current += delta;
    if (time.current > 7.0) { // Efsanevi yetenek 7 saniye sürsün
      onComplete();
      return;
    }

    if (modelRef.current) {
      // Çılgınca Dönüş
      modelRef.current.rotation.z -= delta * 1.5;
      modelRef.current.rotation.y += delta * 0.5;
      modelRef.current.rotation.x = Math.PI / 4; 

      // Boyut animasyonu (Sıfırdan büyür, ekranı kaplar)
      const targetScale = 2.0; 
      const currentScale = Math.min(time.current * 1.5, targetScale);
      // Sona doğru küçülerek yok olsun
      const finalScale = time.current > 6.0 ? Math.max(0, targetScale - (time.current - 6.0) * 2.0) : currentScale;
      modelRef.current.scale.set(finalScale, finalScale, finalScale);
    }
  });

  return (
    <group ref={modelRef} scale={[0, 0, 0]} position={[0, 0, -5]}>
      <primitive object={clonedScene} />
      {/* Dev Sürpriz Işıklar */}
      <pointLight position={[0, 0, 0]} color="#5ce1e6" intensity={50} distance={10} />
      <pointLight position={[2, 0, 2]} color="#ff00ff" intensity={30} distance={10} />
    </group>
  );
}

// ==========================================
// SCENE MANAGER (Birden Fazla Hediyeyi Yönetir)
// ==========================================

export default function PremiumGiftScene3D({ 
  gifts, 
  onGiftComplete 
}: { 
  gifts: QueuedGift[], 
  onGiftComplete: (id: string) => void 
}) {
  if (!gifts || gifts.length === 0) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Canvas camera={{ position: [0, 0, 15], fov: 45 }}>
        {/* Ortam Işıkları */}
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 10, 10]} intensity={1} color="#ffffff" />
        <directionalLight position={[-10, 5, 0]} intensity={0.5} color="#abcdef" />
        
        {/* Hediye Objeleri */}
        {gifts.map((qgift) => {
          const { id, giftId } = qgift as any;
          if (giftId === 'heart') {
            return <HeartStorm key={id} onComplete={() => onGiftComplete(id)} />;
          } else if (giftId === 'crown') {
            return <GoldCrown key={id} onComplete={() => onGiftComplete(id)} />;
          } else if (giftId === 'rocket') {
            return <LuxuryRocket key={id} onComplete={() => onGiftComplete(id)} />;
          } else if (giftId === 'blackhole') {
            return (
              <Suspense key={id} fallback={null}>
                <BlackHoleVortexGift onComplete={() => onGiftComplete(id)} />
              </Suspense>
            );
          } else if (['unicorn', 'dragon', 'cybercity', 'sportscar', 'planet'].includes(giftId)) {
            // Harici GLB modellerini render eden motor - Yükleme için Suspense ile sarıldı
            return (
              <Suspense key={id} fallback={null}>
                <ExternalGLBGift giftId={giftId} onComplete={() => onGiftComplete(id)} />
              </Suspense>
            );
          }
          // Varsayılan / Fallback hediye (Desteklenmeyen 3D hediyeler veya basic ler)
          return null; 
        })}

        {/* Post Processing - BLOOM EFEKTİ (Premium hissiyat) */}
        {!(Platform.OS === 'ios' && Platform.isPad) && (
            <EffectComposer multisampling={0}>
              <Bloom luminanceThreshold={0.85} mipmapBlur intensity={0.6} />
            </EffectComposer>
        )}
      </Canvas>

      {/* Ekran Üstü Bildirim (Kim Kime Gönderdi) Toast Katmanı */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {gifts.map((qgift: any, index: number) => (
          <View key={`toast-${qgift.id}`} style={{
            position: 'absolute',
            top: 140 + (index * 60),
            alignSelf: 'center',
            backgroundColor: 'rgba(30, 20, 45, 0.85)',
            paddingHorizontal: 20,
            paddingVertical: 12,
            borderRadius: 30,
            borderWidth: 1,
            borderColor: 'rgba(168,85,247,0.6)',
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
          }}>
            <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>{qgift.senderName}</Text>
            {qgift.targetName && (
              <>
                <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14 }}>→</Text>
                <Text style={{ color: '#5CE1E6', fontWeight: 'bold', fontSize: 16 }}>{qgift.targetName}</Text>
              </>
            )}
            <Text style={{ color: '#ffb432', fontSize: 15, fontWeight: '600', marginLeft: 4 }}>
              {qgift.giftName} gönderdi!
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}
