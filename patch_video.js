const fs = require('fs');

let c = fs.readFileSync('app/room/[id].tsx', 'utf8');

// 1. Add VideoView import
if (!c.includes('VideoView')) {
  c = c.replace(
    /import \{ useLiveKit \} from '\.\.\/\.\.\/hooks\/useLiveKit';/,
    `import { useLiveKit } from '../../hooks/useLiveKit';\nimport { VideoView } from '@livekit/react-native';`
  );
}

// 2. Update SeatCard Props
c = c.replace(
  /function SeatCard\(\{ nick, role, speaking, mic, size, onPress, avatarUrl, micRequesting, audioLevel = 0, cameraOn = false \}?: \{[\s\S]*?\}\) \{/,
  `function SeatCard({ nick, role, speaking, mic, size, onPress, avatarUrl, micRequesting, audioLevel = 0, cameraOn = false, videoTrack }: {
  nick: string; role: string; speaking: boolean; mic: boolean; size: number; onPress: () => void; avatarUrl?: string; micRequesting?: boolean; audioLevel?: number; cameraOn?: boolean; videoTrack?: any;
}) {`
);

// 3. Update SeatCard rendering of camera placeholder -> VideoView
c = c.replace(
  /\{cameraOn \? \([\s\S]*?\) : avatarUrl \? \(/,
  `{cameraOn && videoTrack ? (
            <View style={{ width: '100%', height: '100%', borderRadius: size/2, overflow: 'hidden' }}>
              <VideoView videoTrack={videoTrack} style={{ flex: 1 }} objectFit="cover" />
              <View style={{ position: 'absolute', top: 4, alignSelf: 'center', backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 4, borderRadius: 4, flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                <Ionicons name="videocam" size={9} color={COLORS.primary} />
                <Text style={{ color: COLORS.primary, fontSize: 7, fontWeight: '700' }}>CANLI</Text>
              </View>
            </View>
          ) : cameraOn ? (
            <LinearGradient colors={['rgba(20,30,50,0.9)', 'rgba(10,15,30,0.9)']} style={[StyleSheet.absoluteFill, { borderRadius: size/2, alignItems: 'center', justifyContent: 'center' }]}>
              <Ionicons name="videocam" size={size * 0.25} color="rgba(92,225,230,0.7)" />
              <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 4 }}>🔴 CANLI</Text>
            </LinearGradient>
          ) : avatarUrl ? (`
);

// 4. Update getMicStatus
c = c.replace(
  /const getMicStatus = \(uid: string\) => \{[\s\S]*?return \{ speaking: simSpeaker \? true : \(p\?\.isSpeaking \|\| false\), mic: p \? !p\.isMuted : false, audioLevel, cameraOn: !!cameraOn \};[\s\S]*?\};/m,
  `const getMicStatus = (uid: string) => {
    const p = lk.participants.find(x => x.identity === uid);
    const audioLevel = p?.audioLevel ?? (simSpeaker ? Math.random() * 0.5 : 0);
    const cameraOn = p?.isCameraEnabled;
    const videoTrack = p?.videoTrack;
    return { speaking: simSpeaker ? true : (p?.isSpeaking || false), mic: p ? !p.isMuted : false, audioLevel, cameraOn: !!cameraOn, videoTrack };
  };`
);

// 5. Update SeatCard instantiations in map
// Host
c = c.replace(
  /getMicStatus\(u\.user_id\);[\s]*?return \([\s\S]*?<SeatCard key=\{u\.id\} nick=\{u\.user\?\.display_name \|\| 'Misafir'\} role=\{u\.role\} speaking=\{st\.speaking\} mic=\{st\.mic\} size=\{hostSize\} onPress=\{\(\) => \{ const _st = getMicStatus\(u\.user_id\); if \(_st\.cameraOn && u\.role !== 'listener'\) \{ setCameraExpandUser\((u\.user?.display_name || 'Misafir')\)[\s\S]*?audioLevel=\{st\.audioLevel\} cameraOn=\{st\.cameraOn\} \/>/gm,
  `getMicStatus(u.user_id);
                   return (
                    <SeatCard key={u.id} nick={u.user?.display_name || 'Misafir'} role={u.role} speaking={st.speaking} mic={st.mic} size={hostSize} onPress={() => { const _st = getMicStatus(u.user_id); if (_st.cameraOn && u.role !== 'listener') { setCameraExpandUser({ nick: u.user?.display_name || 'Misafir', track: _st.videoTrack }); } else { setSelectedUser(u); } }} avatarUrl={u.user?.avatar_url} micRequesting={micRequests.includes(u.user_id)} audioLevel={st.audioLevel} cameraOn={st.cameraOn} videoTrack={st.videoTrack} />`
);

// Speaker
c = c.replace(
  /getMicStatus\(u\.user_id\);[\s]*?return \([\s\S]*?<SeatCard key=\{u\.id\} nick=\{u\.user\?\.display_name \|\| 'Misafir'\} role=\{u\.role\} speaking=\{st\.speaking\} mic=\{st\.mic\} size=\{speakerSize\} onPress=\{\(\) => \{ const _st = getMicStatus\(u\.user_id\); if \(_st\.cameraOn && u\.role !== 'listener'\) \{ setCameraExpandUser\((u\.user?.display_name || 'Misafir')\)[\s\S]*?audioLevel=\{st\.audioLevel\} cameraOn=\{st\.cameraOn\} \/>/gm,
  `getMicStatus(u.user_id);
                   return (
                    <SeatCard key={u.id} nick={u.user?.display_name || 'Misafir'} role={u.role} speaking={st.speaking} mic={st.mic} size={speakerSize} onPress={() => { const _st = getMicStatus(u.user_id); if (_st.cameraOn && u.role !== 'listener') { setCameraExpandUser({ nick: u.user?.display_name || 'Misafir', track: _st.videoTrack }); } else { setSelectedUser(u); } }} avatarUrl={u.user?.avatar_url} micRequesting={micRequests.includes(u.user_id)} audioLevel={st.audioLevel} cameraOn={st.cameraOn} videoTrack={st.videoTrack} />`
);

// 6. Update CameraExpandModal component
c = c.replace(
  /function CameraExpandModal\(\{ nick, onClose \}: \{ nick: string; onClose: \(\) => void \}\) \{/,
  `function CameraExpandModal({ nick, onClose, videoTrack }: { nick: string; onClose: () => void; videoTrack?: any }) {`
);

c = c.replace(
  /<View style=\{\{ width: W \* 0\.85, height: W \* 0\.85, borderRadius: 24[\s\S]*?<\/LinearGradient>/,
  `<View style={{ width: W * 0.85, height: W * 0.85, borderRadius: 24, overflow: 'hidden', borderWidth: 2, borderColor: COLORS.primary, backgroundColor: '#000', elevation: 20, shadowColor: COLORS.primary, shadowOpacity: 0.5, shadowRadius: 30 }}>
        {videoTrack ? (
           <VideoView videoTrack={videoTrack} style={{ flex: 1 }} objectFit="cover" />
        ) : (
           <LinearGradient colors={['rgba(20,30,50,0.9)', 'rgba(10,15,30,0.9)']} style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
             <Ionicons name="videocam" size={60} color="rgba(92,225,230,0.3)" />
             <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 18, marginTop: 12, fontWeight: 'bold' }}>{nick} - CANLI YAYIN</Text>
           </LinearGradient>
        )}`
);

// 7. Update cameraExpandUser state and render usage
c = c.replace(
  /const \[cameraExpandUser, setCameraExpandUser\] = useState<string \| null>\(null\);/,
  `const [cameraExpandUser, setCameraExpandUser] = useState<{nick: string, track: any} | null>(null);`
);

c = c.replace(
  /\{!!cameraExpandUser && \([\s]*?<CameraExpandModal nick=\{cameraExpandUser\} onClose=\{\(\) => setCameraExpandUser\(null\)\} \/>[\s]*?\)\}/,
  `{!!cameraExpandUser && (
        <CameraExpandModal nick={cameraExpandUser.nick} videoTrack={cameraExpandUser.track} onClose={() => setCameraExpandUser(null)} />
      )}`
);

fs.writeFileSync('app/room/[id].tsx', c);
console.log('Video patch applied!');
