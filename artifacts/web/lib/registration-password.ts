export const REGISTRATION_PASSWORD_REQUIREMENTS = [
  { id: "length", label: "Entre 12 y 128 caracteres", test: (value: string) => value.length >= 12 && value.length <= 128 },
  { id: "lowercase", label: "Una letra minúscula", test: (value: string) => /[a-z]/.test(value) },
  { id: "uppercase", label: "Una letra mayúscula", test: (value: string) => /[A-Z]/.test(value) },
  { id: "number", label: "Un número", test: (value: string) => /[0-9]/.test(value) },
  { id: "symbol", label: "Un símbolo", test: (value: string) => /[^A-Za-z0-9]/.test(value) },
] as const;

export function registrationPasswordStatus(value: string) {
  return REGISTRATION_PASSWORD_REQUIREMENTS.map((requirement) => ({
    ...requirement,
    met: requirement.test(value),
  }));
}

export function isRegistrationPasswordValid(value: string) {
  return registrationPasswordStatus(value).every((requirement) => requirement.met);
}
