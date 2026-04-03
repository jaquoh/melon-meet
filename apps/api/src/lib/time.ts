import { addMinutes, addWeeks, differenceInMinutes, format, getDay } from "date-fns";
import { fromZonedTime, toZonedTime } from "date-fns-tz";

export function nowIso() {
  return new Date().toISOString();
}

export function combineLocalDateTime(
  localDate: string,
  localTime: string,
  timeZone: string,
) {
  return fromZonedTime(`${localDate}T${localTime}:00`, timeZone);
}

export function isoToLocalDate(iso: string, timeZone: string) {
  return format(toZonedTime(iso, timeZone), "yyyy-MM-dd");
}

export function isoToLocalTime(iso: string, timeZone: string) {
  return format(toZonedTime(iso, timeZone), "HH:mm");
}

export function isoToWeekday(iso: string, timeZone: string) {
  return getDay(toZonedTime(iso, timeZone));
}

export function durationMinutes(startIso: string, endIso: string) {
  return differenceInMinutes(new Date(endIso), new Date(startIso));
}

export function addDuration(startIso: string, minutes: number) {
  return addMinutes(new Date(startIso), minutes).toISOString();
}

export function horizonDate(weeks = 12) {
  return format(addWeeks(new Date(), weeks), "yyyy-MM-dd");
}

export function shiftDateByWeeks(localDate: string, amount: number) {
  const seed = new Date(`${localDate}T12:00:00.000Z`);
  return format(addWeeks(seed, amount), "yyyy-MM-dd");
}
