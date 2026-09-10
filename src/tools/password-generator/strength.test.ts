import { expect, it } from 'vitest';
import { ratePassword } from './strength';

it('rates short passwords as Debole even with mixed categories', () => {
  expect(ratePassword('Ab1!xyz')).toBe('Debole');
});

it('rates a 16-character four-category password without runs or repeats as Robusta', () => {
  expect(ratePassword('Kd9!mP2@qL7#zX4$')).toBe('Robusta');
});

it('drops a step when a sequence or a repeated character is present', () => {
  expect(ratePassword('Kd9!mP2@qLabc')).toBe('Buona');
  expect(ratePassword('Kd9!mP2@qL7#K')).toBe('Buona');
});
