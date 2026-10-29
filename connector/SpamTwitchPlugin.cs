using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Reflection;
using System.Text.RegularExpressions;
using BepInEx;
using BepInEx.Configuration;
using Newtonsoft.Json;
using Spam.MenuV3;
using TcgEngine;
using TcgEngine.Client;
using UnityEngine;
using UnityEngine.SceneManagement;

namespace SpamTwitch
{
    [BepInPlugin("fr.spamtools.twitch", "SPAM Twitch Connector", "0.1.4")]
    [BepInProcess("SPAM.exe")]
    public sealed class SpamTwitchPlugin : BaseUnityPlugin
    {
        private ConfigEntry<string> outputDirectory;
        private ConfigEntry<float> interval;
        private float nextCapture;
        private float nextDiscovery;
        private CardController[] controllers = new CardController[0];
        private DraftTalentCardController[] talentCards = new DraftTalentCardController[0];
        private readonly string sessionId = Guid.NewGuid().ToString("N");
        private long sequence;
        private DateTime nextError;
        private readonly Vector3[] corners = new Vector3[4];
        private static readonly FieldInfo WireSmoked = typeof(Card).GetField("_wireSmoked", BindingFlags.Instance | BindingFlags.NonPublic);
        // These are the rows actually exposed by the draft screen, not the full talent catalog.
        private static readonly FieldInfo DraftCard = typeof(DraftTalentCardController).GetField("_cardController", BindingFlags.Instance | BindingFlags.NonPublic);
        private static readonly FieldInfo DraftRows = typeof(DraftTalentCardController).GetField("_talentRows", BindingFlags.Instance | BindingFlags.NonPublic);

        private void Awake()
        {
            outputDirectory = Config.Bind("Connector", "OutputDirectory",
                Path.Combine(Paths.GameRootPath, "BepInEx", "spam-twitch"),
                "Local folder read by the SPAM Twitch companion. No game credentials are exported.");
            interval = Config.Bind("Connector", "CaptureIntervalSeconds", 0.25f,
                "Visible UI sampling interval, clamped between 0.15 and 2 seconds.");
            Directory.CreateDirectory(outputDirectory.Value);
            Logger.LogInfo("SPAM Twitch connector ready. Output: " + outputDirectory.Value);
        }

        private static float ValueOr(Func<float> read, float fallback) { try { return read(); } catch { return fallback; } }

        private void Update()
        {
            if (Time.realtimeSinceStartup < nextCapture) return;
            nextCapture = Time.realtimeSinceStartup + Mathf.Clamp(interval.Value, 0.15f, 2f);
            try { Capture(); }
            catch (Exception error)
            {
                if (DateTime.UtcNow >= nextError)
                {
                    nextError = DateTime.UtcNow.AddSeconds(15);
                    Logger.LogWarning("Capture failed: " + error.GetType().Name + " " + error.Message);
                }
            }
        }

        private void Capture()
        {
            if (Time.realtimeSinceStartup >= nextDiscovery)
            {
                nextDiscovery = Time.realtimeSinceStartup + 1f;
                controllers = UnityEngine.Object.FindObjectsByType<CardController>(FindObjectsSortMode.None);
                talentCards = UnityEngine.Object.FindObjectsByType<DraftTalentCardController>(FindObjectsSortMode.None);
            }
            var cards = new List<object>();
            foreach (var controller in controllers)
            {
                if (cards.Count >= 64) break;
                try
                {
                    if (!controller || !controller.isActiveAndEnabled || controller.IsReturned ||
                        controller.RunningIsReturned) continue;
                    var front = controller.FrontMask;
                    if (!front || !front.gameObject.activeInHierarchy || !Visible(controller)) continue;
                    var board = controller.GetComponentInParent<BoardCardController>();
                    Card runtime = board ? board.Card : null;
                    if (runtime == null && !String.IsNullOrEmpty(controller.CardGameId))
                        runtime = GameClient.GetCard(controller.CardGameId);
                    // Smoke, face-down and in-flight shuffles must never reveal their underlying model.
                    if (board && (board.IsHiddenOnScreen || board.IsShuffling)) continue;
                    if (runtime != null && (runtime.IsSmoked() ||
                        (WireSmoked != null && (bool)WireSmoked.GetValue(runtime)))) continue;
                    var bounds = Bounds(front);
                    if (bounds == null) continue;
                    // Combat rendering resolves CardGameId instead of setting the menu CardData property.
                    // Use the same runtime model as UpdateGameGraphics, after the visibility checks above.
                    if (!String.IsNullOrEmpty(controller.CardGameId) && runtime == null) continue;
                    var data = runtime != null ? runtime.CardData : controller.CardData;
                    if (data == null) continue;
                    var abilities = new List<object>();
                    foreach (var row in controller.AbilityControllers)
                    {
                        if (!row || !row.isActiveAndEnabled || !Visible(row)) continue;
                        var active = row.AbilityActiveData;
                        var passive = row.AbilityPassiveData;
                        if (active)
                        {
                            abilities.Add(new {
                                id = row.Id, name = Plain(active.GetTitle()), kind = "active",
                                description = Plain(runtime != null ? active.GetDescWithDynamicValue(runtime) : active.GetDescWithValue()),
                                cooldown = row.CurrentCooldown, maxCooldown = row.MaxCooldown,
                                precision = 100f - (runtime != null ? ValueOr(() => runtime.GetChanceOfMiss(active), active.chanceOfMiss) : active.chanceOfMiss),
                                criticalChance = active.CanCrit ? (float?)(runtime != null ? ValueOr(() => runtime.GetChanceOfCritick(active), active.chanceOfCrit) : active.chanceOfCrit) : null,
                                criticalMultiplier = active.CanCrit ? (float?)(runtime != null ? ValueOr(() => runtime.GetCritickDamageRatio(active), active.CritickDamageRatio) : active.CritickDamageRatio) : null
                            });
                        }
                        else if (passive)
                        {
                            abilities.Add(new {
                                id = row.Id, name = Plain(passive.GetTitle()), kind = "passive",
                                description = Plain(passive.GetDesc()), cooldown = 0, maxCooldown = 0
                            });
                        }
                    }
                    cards.Add(new {
                        instanceId = controller.GetInstanceID().ToString(), cardId = data.Id,
                        name = Plain(data.Name), description = Plain(data.Description),
                        element = data.Element ? Plain(data.Element.Name) : "",
                        details = new {
                            rarity = data.Rarity ? Plain(data.Rarity.Name) : "",
                            species = Plain(data.Species), region = Plain(data.Region),
                            resistances = new {
                                fire = runtime != null ? ValueOr(() => runtime.GetResistance(Spam.Data.ElementData.Fire), data.FireResistance) : data.FireResistance,
                                water = runtime != null ? ValueOr(() => runtime.GetResistance(Spam.Data.ElementData.Water), data.WaterResistance) : data.WaterResistance,
                                earth = runtime != null ? ValueOr(() => runtime.GetResistance(Spam.Data.ElementData.Earth), data.EarthResistance) : data.EarthResistance,
                                nature = runtime != null ? ValueOr(() => runtime.GetResistance(Spam.Data.ElementData.Nature), data.NatureResistance) : data.NatureResistance,
                                shadow = runtime != null ? ValueOr(() => runtime.GetResistance(Spam.Data.ElementData.Shadow), data.ShadowResistance) : data.ShadowResistance,
                                light = runtime != null ? ValueOr(() => runtime.GetResistance(Spam.Data.ElementData.Light), data.LightResistance) : data.LightResistance
                            }
                        },
                        hp = runtime != null ? runtime.GetHP() : data.Hp,
                        maxHp = runtime != null ? runtime.GetHPMax() : data.Hp,
                        // Match UpdateGameGraphics: GetCoinsGeneration uses a legacy data field
                        // that is not populated on the current network card model.
                        income = runtime != null ? runtime.GetRuntimeCoinsGeneration() + data.GoldIncome : data.GoldIncome,
                        side = runtime != null ? (controller.IsMyCard ? "ally" : "opponent") : "collection",
                        bounds = bounds, abilities = abilities,
                        order = controller.transform.GetSiblingIndex()
                    });
                }
                catch (Exception error)
                {
                    if (DateTime.UtcNow >= nextError)
                    {
                        nextError = DateTime.UtcNow.AddSeconds(15);
                        Logger.LogWarning("A card was skipped: " + error);
                    }
                }
            }
            CaptureTalents(cards);
            var snapshot = new {
                version = 1, sessionId = sessionId, sequence = ++sequence,
                capturedAt = (long)(DateTime.UtcNow - new DateTime(1970, 1, 1)).TotalMilliseconds,
                source = "game", scene = SceneManager.GetActiveScene().name,
                screen = new { width = Screen.width, height = Screen.height }, cards = cards
            };
            var target = Path.Combine(outputDirectory.Value, "state.json");
            var temporary = target + ".tmp";
            File.WriteAllText(temporary, JsonConvert.SerializeObject(snapshot));
            if (File.Exists(target)) File.Replace(temporary, target, null);
            else File.Move(temporary, target);
        }

        private void CaptureTalents(List<object> cards)
        {
            if (DraftCard == null || DraftRows == null) return;
            foreach (var draft in talentCards)
            {
                if (cards.Count >= 64) break;
                try
                {
                    if (!draft || !draft.isActiveAndEnabled || !Visible(draft)) continue;
                    var controller = DraftCard.GetValue(draft) as CardController;
                    var rows = DraftRows.GetValue(draft) as TalentRowController[];
                    if (!controller || !controller.isActiveAndEnabled || !Visible(controller) ||
                        controller.IsReturned || controller.RunningIsReturned || rows == null) continue;
                    if (!controller.FrontMask || !controller.FrontMask.gameObject.activeInHierarchy) continue;
                    var board = controller.GetComponentInParent<BoardCardController>();
                    if (board && (board.IsHiddenOnScreen || board.IsShuffling)) continue;
                    // Resolve the same model as DraftTalentCardController.UpdateTalent.
                    Card runtime = String.IsNullOrEmpty(controller.CardGameId) ? null : GameClient.GetCard(controller.CardGameId);
                    if (!String.IsNullOrEmpty(controller.CardGameId) && runtime == null) continue;
                    if (runtime != null && (runtime.IsSmoked() ||
                        (WireSmoked != null && (bool)WireSmoked.GetValue(runtime)))) continue;
                    var data = runtime != null ? runtime.CardData : controller.CardData;
                    if (data == null) continue;
                    for (int index = 0; index < rows.Length && cards.Count < 64; index++)
                    {
                        var row = rows[index];
                        // Opponent panels and unused rows are hidden by the game: never export them.
                        if (!row || !row.isActiveAndEnabled || !Visible(row)) continue;
                        var rect = row.transform as RectTransform;
                        if (!rect) continue;
                        var bounds = Bounds(rect);
                        if (bounds == null) continue;
                        var talent = index == 0 ? TalentData.NoTalent :
                            (data.Talents != null && index - 1 < data.Talents.Count ? data.Talents[index - 1] : null);
                        if (!talent) continue;
                        var title = Plain(talent.Name);
                        var description = Plain(talent.Description);
                        if (String.IsNullOrEmpty(title)) continue;
                        var state = row.Value ? "Sélectionné" : (row.IsUnlocked ? "Disponible" : "Verrouillé");
                        // Reuse protocol v1 hover targets and passive descriptions. No Twitch asset update.
                        cards.Add(new {
                            instanceId = "talent:" + draft.GetInstanceID() + ":" + index,
                            cardId = "talent:" + talent.id,
                            name = title, description = "", element = "Talent",
                            hp = 0, maxHp = 0, income = 0,
                            side = runtime != null ? (controller.IsMyCard ? "ally" : "opponent") : "collection",
                            bounds = bounds, order = index,
                            abilities = new [] { new {
                                id = talent.id, name = Plain(data.Name) + " · " + state,
                                kind = "passive", description = description, cooldown = 0, maxCooldown = 0
                            } }
                        });
                    }
                }
                catch (Exception error)
                {
                    if (DateTime.UtcNow >= nextError)
                    {
                        nextError = DateTime.UtcNow.AddSeconds(15);
                        Logger.LogWarning("Talent rows were skipped: " + error);
                    }
                }
            }
        }

        private static bool Visible(Component component)
        {
            if (!component.gameObject.activeInHierarchy) return false;
            foreach (var group in component.GetComponentsInParent<CanvasGroup>())
                if (group.alpha < 0.05f) return false;
            return true;
        }

        private object Bounds(RectTransform rect)
        {
            if (Screen.width < 1 || Screen.height < 1) return null;
            var canvas = rect.GetComponentInParent<Canvas>();
            if (!canvas || !canvas.isActiveAndEnabled) return null;
            var camera = canvas.renderMode == RenderMode.ScreenSpaceOverlay ? null : canvas.worldCamera;
            if (canvas.renderMode != RenderMode.ScreenSpaceOverlay && !camera) camera = Camera.main;
            rect.GetWorldCorners(corners);
            var points = corners.Select(p => RectTransformUtility.WorldToScreenPoint(camera, p)).ToArray();
            var left = Mathf.Clamp01(points.Min(p => p.x) / Screen.width);
            var right = Mathf.Clamp01(points.Max(p => p.x) / Screen.width);
            var top = Mathf.Clamp01(1f - points.Max(p => p.y) / Screen.height);
            var bottom = Mathf.Clamp01(1f - points.Min(p => p.y) / Screen.height);
            if (right - left < 0.008f || bottom - top < 0.015f) return null;
            return new { x = Round(left), y = Round(top), w = Round(right - left), h = Round(bottom - top) };
        }

        private static double Round(float value) { return Math.Round(value, 4); }
        private static string Plain(string value)
        {
            if (String.IsNullOrEmpty(value)) return "";
            value = Regex.Replace(value, @"<br\s*/?>", "\n", RegexOptions.IgnoreCase);
            value = Regex.Replace(value, "<sprite[^>]*name=[\"']?([^\"' >]+)[\"']?[^>]*>", "[$1]", RegexOptions.IgnoreCase);
            return Regex.Replace(value, "<[^>]+>", "").Trim();
        }
    }
}
