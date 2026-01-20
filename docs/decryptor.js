/**
 * Browser-side decryption library for photos encrypted with main.js
 */
export const PhotoDecryptor = (() => {
    const ALGORITHM = 'AES-GCM';
    const KEY_LENGTH = 256; 
    const ITERATIONS = 600000;
    const DIGEST = 'SHA-256';

    function base64urlToUint8Array(base64url) {
        const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
        const binary = window.atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        return bytes;
    }

    function hexToUint8Array(hex) {
        return new Uint8Array(hex.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
    }

    async function deriveKey(password, salt, domain) {
        const enc = new TextEncoder();
        const keyMaterial = await window.crypto.subtle.importKey(
            'raw',
            enc.encode(password + domain),
            { name: 'PBKDF2' },
            false,
            ['deriveKey']
        );

        return window.crypto.subtle.deriveKey(
            {
                name: 'PBKDF2',
                salt: salt,
                iterations: ITERATIONS,
                hash: DIGEST
            },
            keyMaterial,
            { name: ALGORITHM, length: KEY_LENGTH },
            false,
            ['decrypt']
        );
    }

    async function decrypt(combinedBase64url, ivHex, key) {
        const combined = base64urlToUint8Array(combinedBase64url);
        const iv = hexToUint8Array(ivHex);

        return await window.crypto.subtle.decrypt(
            {
                name: ALGORITHM,
                iv: iv,
                tagLength: 128
            },
            key,
            combined
        );
    }

    return {
        decryptPhoto: async (doc, password, type = 'fullsize') => {
            const domain = type === 'thumbnail' ? "thumbnail" : "fullsize";
            const salt = hexToUint8Array(doc.salt);
            const iv = type === 'thumbnail' ? doc.thumbIv : doc.iv;
            const data = type === 'thumbnail' ? doc.thumbnail : doc.data;

            if (!data || !iv) throw new Error(`Data or IV missing for type: ${type}`);

            const key = await deriveKey(password, salt, domain);
            const decryptedBuffer = await decrypt(data, iv, key);

            const mimeType = doc.metadata?.format ? `image/${doc.metadata.format}` : 'image/jpeg';
            return new Blob([decryptedBuffer], { type: mimeType });
        },

        createImageObjectURL: async (doc, password, type) => {
            const blob = await PhotoDecryptor.decryptPhoto(doc, password, type);
            return URL.createObjectURL(blob);
        }
    };
})();