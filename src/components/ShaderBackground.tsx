import { Shader, Halftone, SolidColor, Swirl } from 'shaders/react';

export default function ShaderBackground() {
  return (
    <div className="fixed inset-0 z-0 h-screen w-screen">
      <Shader style={{ width: '100%', height: '100%', display: 'block' }}>
        <SolidColor color="#000000" />
        <Halftone angle={24} frequency={158}>
          <Swirl blend={43} colorA="#0c2a40" colorB="#000000" detail={1.1} />
        </Halftone>
      </Shader>
    </div>
  );
}
