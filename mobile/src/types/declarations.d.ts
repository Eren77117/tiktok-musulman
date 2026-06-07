declare module '@react-native-camera-roll/camera-roll' {
  export const CameraRoll: {
    save(tag: string, options?: { type?: 'photo' | 'video' | 'auto'; album?: string }): Promise<string>;
    saveAsset(tag: string, options?: { type?: 'photo' | 'video' | 'auto'; album?: string }): Promise<string>;
    getPhotos(params: any): Promise<any>;
  };
}
