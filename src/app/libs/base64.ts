export const toBase64 = (obj: object) => {
    return Buffer.from(JSON.stringify(obj)).toString('base64');
};

export const fromBase64 = <T>(str: string): T => {
    return JSON.parse(Buffer.from(str, 'base64').toString());
};
