import { useEffect, useState } from "react";
import api from "@/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Controller, useForm } from "react-hook-form";
import { useNavigate } from "react-router";
import * as zod from 'zod';
import { zodResolver } from "@hookform/resolvers/zod";

const TIME_SLOTS = ["12:00", "12:30", "13:00", "13:30", "19:00", "19:30", "20:00"];

const CUTOFF_MS = 2 * 60 * 60 * 1000;

const isError = (res) => res instanceof Error || res?.isAxiosError;

const todayISO = () => {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 10);
};

const isTooLate = (date, time) =>
    new Date(`${date}T${time}`).getTime() - Date.now() < CUTOFF_MS;

function PageReservations() {
  const [date, setDate] = useState(todayISO());
  const [time, setTime] = useState(null);
  const [people, setPeople] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  // when changing date, the selected slot could be not available anymore
  useEffect(() => {
    if (time && isTooLate(date, time)) setTime(null);
  }, [date]);

  const canSubmit = date && time && people >= 1 && !submitting;
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;

    setSubmitting(true);
    const res = await api.reservations.create({ date, time, people });
    setSubmitting(false);

    if (isError(res)) return; // toast d'errore già mostrato da httpClient

    toast.success("Reservation confirmed!");
    setTime(null);
    setPeople(1);
  };

  return (
    <Card className="max-w-xl mx-auto">
      <CardHeader>
        <CardTitle>Book a table</CardTitle>
        <CardDescription>
          Tables are shared. You can book up to 2 hours before the chosen time.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                  <Label htmlFor="date">Date</Label>
                  <Input
                      id="date"
                      type="date"
                      min={todayISO()}
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      required
                  />
              </div>
              <div className="space-y-2">
                  <Label htmlFor="people">Number of people</Label>
                  <Input
                      id="people"
                      type="number"
                      min={1}
                      value={people}
                      onChange={(e) => setPeople(parseInt(e.target.value, 10) || 0)}
                      required
                  />
              </div>
          </div>

          <div className="space-y-2">
              <Label>Time</Label>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {TIME_SLOTS.map((slot) => (
                      <Button
                          key={slot}
                          type="button"
                          variant={time === slot ? "default" : "outline"}
                          disabled={isTooLate(date, slot)}
                          onClick={() => setTime(slot)}
                      >
                          {slot}
                      </Button>
                  ))}
              </div>
          </div>

          <Button type="submit" className="w-full" disabled={!canSubmit}>
              {submitting ? "Booking..." : "Confirm reservation"}
          </Button>
      </form>
      </CardContent>
    </Card>
  )
}

export default PageReservations;