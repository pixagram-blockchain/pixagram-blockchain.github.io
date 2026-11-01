import { Howl } from "howler";

// Howler keeps every Howl it ever created in Howler._howls until unload(), so
// a new Howl per play grew without bound. Effects now get one Howl per sound
// file, reused for every play. unload() alone is not the fix for effects: it
// also drops the shared decoded buffer, so each play would download and decode
// the file again. Music changes rarely, so the previous track is unloaded
// (which also releases its html5 Audio element).
const _effects = new Map(); // src -> Howl
var _sound_object_music = {stop: function (){}, unload: function (){}};
var _sound_object_effect = {stop: function (){}};

function effectHowl(src, volume) {
    let howl = _effects.get(src);
    if (!howl) {
        howl = new Howl({
            src: [src],
            volume
        });
        _effects.set(src, howl);
    } else {
        howl.volume(volume);
    }
    return howl;
}

export function play_sound(category, pack, name, volume_optional, global_optional) {

    const volume = volume_optional || 1;
    const global = global_optional || false;
    const src_mp3 =  "/src/sounds/" + category + "/" + pack + "/" + name + ".mp3";

    if(global) {

        _sound_object_music.unload();
        _sound_object_music = new Howl({
            src: [src_mp3],
            html5: true,
            loop: true,
            preload: true,
            volume,
            onplayerror: function() {
                _sound_object_music.once('unlock', function() {
                    _sound_object_music.stop();
                    _sound_object_music.play();
                });
            }
        });

        _sound_object_music.play();

    }else {

        _sound_object_effect.stop();
        _sound_object_effect = effectHowl(src_mp3, volume);
        _sound_object_effect.play();
    }

}

export function stop_sound() {

    _sound_object_music.stop();
    _sound_object_effect.stop();
}
