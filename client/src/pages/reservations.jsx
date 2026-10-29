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

function PageReservations() {

  return (
    <Card>
      <CardHeader>
        <CardTitle></CardTitle>
        <CardDescription>
          
        </CardDescription>
      </CardHeader>
      <CardContent>
        
      </CardContent>
    </Card>
  )
}

export default PageReservations;