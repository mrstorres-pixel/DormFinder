<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class NotificationContext
{
    public function attach(Collection $rows, User $recipient): Collection
    {
        $direct = $inquiries = $viewings = $reports = [];
        foreach ($rows as $row) {
            if (preg_match('~^/(?:landlord/properties|admin/reviews)/(\d+)(?:[?#]|$)~', $row->path, $match)) {
                $direct[$row->id] = (int) $match[1];
            } elseif (preg_match('~^/inquiries/(\d+)(?:[?#]|$)~', $row->path, $match)) {
                $inquiries[$row->id] = (int) $match[1];
            } elseif (preg_match('/^viewing:(\d+):/', $row->event_key, $match)) {
                $viewings[$row->id] = (int) $match[1];
            } elseif (preg_match('/^report(?:-closed)?:(\d+)$/', $row->event_key, $match)) {
                $reports[$row->id] = (int) $match[1];
            }
        }
        $properties = $direct ? DB::table('properties')->whereIn('id', array_values($direct))->when($recipient->role !== 'admin', fn ($query) => $query->where('landlord_id', $recipient->id))->pluck('title', 'id') : collect();
        $contexts = [];
        foreach (['inquiries' => $inquiries, 'viewing_requests' => $viewings, 'listing_reports' => $reports] as $table => $ids) {
            $contexts[$table] = $ids ? DB::table($table)->join('properties', 'properties.id', '=', $table.'.property_id')->whereIn($table.'.id', array_values($ids))
                ->where(function ($query) use ($table, $recipient): void {
                    if ($table === 'listing_reports' && $recipient->role === 'admin') {
                        return;
                    }
                    $query->where($table.'.student_id', $recipient->id);
                    if ($table !== 'listing_reports') {
                        $query->orWhere($table.'.landlord_id', $recipient->id);
                    }
                })->pluck('properties.title', $table.'.id') : collect();
        }

        return $rows->map(function (object $row) use ($direct, $inquiries, $viewings, $reports, $properties, $contexts): object {
            $row->listing_title = $properties[$direct[$row->id] ?? 0] ?? $contexts['inquiries'][$inquiries[$row->id] ?? 0] ?? $contexts['viewing_requests'][$viewings[$row->id] ?? 0] ?? $contexts['listing_reports'][$reports[$row->id] ?? 0] ?? null;
            unset($row->event_key);

            return $row;
        });
    }
}
