import { Module } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module';
import { GeocodingModule } from '../geocoding/geocoding.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { GeofencesModule } from '../geofences/geofences.module';

import { StationsService } from './stations/stations.service';
import { StationsController } from './stations/stations.controller';

import { LocomotivesService } from './locomotives/locomotives.service';
import { LocomotivesController } from './locomotives/locomotives.controller';

import { RakesService } from './rakes/rakes.service';
import { RakesController } from './rakes/rakes.controller';

import { LocoPilotsService } from './loco-pilots/loco-pilots.service';
import { LocoPilotsController } from './loco-pilots/loco-pilots.controller';

import { TrainsService } from './trains/trains.service';
import { TrainsController } from './trains/trains.controller';

import { RailRoutingService } from './routing/rail-routing.service';
import { RailSimulationService } from './movements/rail-simulation.service';
import { TrainMovementsService } from './movements/train-movements.service';
import { TrainMovementsController } from './movements/train-movements.controller';

import { RailCarbonService } from './intelligence/rail-carbon.service';
import { CrewScoringService } from './intelligence/crew-scoring.service';
import { RailEtaService } from './intelligence/rail-eta.service';
import { SlotIntelligenceService } from './intelligence/slot-intelligence.service';
import { RailPdfReportService } from './reports/rail-pdf-report.service';

@Module({
  imports: [
    SupabaseModule,
    GeocodingModule,
    RealtimeModule,
    NotificationsModule,
    GeofencesModule,
  ],
  controllers: [
    StationsController,
    LocomotivesController,
    RakesController,
    LocoPilotsController,
    TrainsController,
    TrainMovementsController,
  ],
  providers: [
    StationsService,
    LocomotivesService,
    RakesService,
    LocoPilotsService,
    TrainsService,
    RailRoutingService,
    RailSimulationService,
    TrainMovementsService,
    RailCarbonService,
    CrewScoringService,
    RailEtaService,
    SlotIntelligenceService,
    RailPdfReportService,
  ],
  exports: [
    StationsService,
    LocomotivesService,
    RakesService,
    LocoPilotsService,
    TrainsService,
    RailRoutingService,
    RailSimulationService,
    TrainMovementsService,
    RailCarbonService,
    CrewScoringService,
    RailEtaService,
    SlotIntelligenceService,
    RailPdfReportService,
  ],
})
export class RailwaysModule {}
