module.exports = "@export ecgl.realistic.vertex\n\n@import ecgl.common.transformUniforms\n\n@import ecgl.common.uvUniforms\n\n@import ecgl.common.attributes\n\n\n@import ecgl.common.wireframe.vertexHeader\n\n#ifdef VERTEX_COLOR\nattribute vec4 a_Color : COLOR;\nvarying vec4 v_Color;\n#endif\n\n#ifdef NORMALMAP_ENABLED\nattribute vec4 tangent : TANGENT;\nvarying vec3 v_Tangent;\nvarying vec3 v_Bitangent;\n#endif\n\n@import ecgl.common.vertexAnimation.header\n\n\n\nvarying vec2 v_Texcoord;\n\nvarying vec3 v_Normal;\nvarying vec3 v_WorldPosition;\n\nvoid main()\n{\n v_Texcoord = texcoord * uvRepeat + uvOffset;\n\n @import ecgl.common.vertexAnimation.main\n\n gl_Position = worldViewProjection * vec4(pos, 1.0);\n\n v_Normal = normalize((worldInverseTranspose * vec4(norm, 0.0)).xyz);\n v_WorldPosition = (world * vec4(pos, 1.0)).xyz;\n\n#ifdef VERTEX_COLOR\n v_Color = a_Color;\n#endif\n\n#ifdef NORMALMAP_ENABLED\n v_Tangent = normalize((worldInverseTranspose * vec4(tangent.xyz, 0.0)).xyz);\n v_Bitangent = normalize(cross(v_Normal, v_Tangent) * tangent.w);\n#endif\n\n @import ecgl.common.wireframe.vertexMain\n\n}\n\n@end\n\n\n\n@export ecgl.realistic.fragment\n\n#define LAYER_DIFFUSEMAP_COUNT 0\n#define LAYER_EMISSIVEMAP_COUNT 0\n#define PI 3.14159265358979\n#define ROUGHNESS_CHANEL 0\n#define METALNESS_CHANEL 1\n\n#define NORMAL_UP_AXIS 1\n#define NORMAL_FRONT_AXIS 2\n\n#ifdef VERTEX_COLOR\nvarying vec4 v_Color;\n#endif\n\nvarying vec2 v_Texcoord;\nvarying vec3 v_Normal;\nvarying vec3 v_WorldPosition;\n\n#ifdef DIFFUSEMAP_ENABLED\nuniform sampler2D diffuseMap;\n#endif\n\n#ifdef METALNESSMAP_ENABLED\nuniform sampler2D metalnessMap;\n#endif\n\n#ifdef ROUGHNESSMAP_ENABLED\nuniform sampler2D roughnessMap;\n#endif\n\n@import ecgl.common.layers.header\n\nuniform float emissionIntensity: 1.0;\n\nuniform vec4 color : [1.0, 1.0, 1.0, 1.0];\n\nuniform float metalness : 0.0;\nuniform float roughness : 0.5;\n\nuniform mat4 viewInverse : VIEWINVERSE;\n\n#ifdef AMBIENT_LIGHT_COUNT\n@import qtek.header.ambient_light\n#endif\n\n#ifdef AMBIENT_SH_LIGHT_COUNT\n@import qtek.header.ambient_sh_light\n#endif\n\n#ifdef AMBIENT_CUBEMAP_LIGHT_COUNT\n@import qtek.header.ambient_cubemap_light\n#endif\n\n#ifdef DIRECTIONAL_LIGHT_COUNT\n@import qtek.header.directional_light\n#endif\n\n#ifdef NORMALMAP_ENABLED\nvarying vec3 v_Tangent;\nvarying vec3 v_Bitangent;\nuniform sampler2D normalMap;\n#endif\n\n@import ecgl.common.ssaoMap.header\n\n@import ecgl.common.bumpMap.header\n\n@import qtek.util.srgb\n\n@import qtek.util.rgbm\n\n@import ecgl.common.wireframe.fragmentHeader\n\n@import qtek.plugin.compute_shadow_map\n\nvec3 F_Schlick(float ndv, vec3 spec) {\n return spec + (1.0 - spec) * pow(1.0 - ndv, 5.0);\n}\n\nfloat D_Phong(float g, float ndh) {\n float a = pow(8192.0, g);\n return (a + 2.0) / 8.0 * pow(ndh, a);\n}\n\nvoid main()\n{\n vec4 albedoColor = color;\n\n vec3 eyePos = viewInverse[3].xyz;\n vec3 V = normalize(eyePos - v_WorldPosition);\n#ifdef VERTEX_COLOR\n #ifdef SRGB_DECODE\n albedoColor *= sRGBToLinear(v_Color);\n #else\n albedoColor *= v_Color;\n #endif\n#endif\n\n vec4 albedoTexel = vec4(1.0);\n#ifdef DIFFUSEMAP_ENABLED\n albedoTexel = texture2D(diffuseMap, v_Texcoord);\n #ifdef SRGB_DECODE\n albedoTexel = sRGBToLinear(albedoTexel);\n #endif\n#endif\n\n @import ecgl.common.diffuseLayer.main\n\n albedoColor *= albedoTexel;\n\n float m = metalness;\n\n#ifdef METALNESSMAP_ENABLED\n float m2 = texture2D(metalnessMap, v_Texcoord)[METALNESS_CHANEL];\n m = clamp(m2 + (m - 0.5) * 2.0, 0.0, 1.0);\n#endif\n\n vec3 baseColor = albedoColor.rgb;\n albedoColor.rgb = baseColor * (1.0 - m);\n vec3 specFactor = mix(vec3(0.04), baseColor, m);\n\n float g = 1.0 - roughness;\n\n#ifdef ROUGHNESSMAP_ENABLED\n float g2 = 1.0 - texture2D(roughnessMap, v_Texcoord)[ROUGHNESS_CHANEL];\n g = clamp(g2 + (g - 0.5) * 2.0, 0.0, 1.0);\n#endif\n\n vec3 N = v_Normal;\n\n#ifdef DOUBLE_SIDE\n if (dot(N, V) < 0.0) {\n N = -N;\n }\n#endif\n\n float ambientFactor = 1.0;\n\n#ifdef BUMPMAP_ENABLED\n N = bumpNormal(v_WorldPosition, v_Normal, N);\n ambientFactor = dot(v_Normal, N);\n#endif\n\n#ifdef NORMALMAP_ENABLED\n if (dot(v_Tangent, v_Tangent) > 0.0) {\n vec3 normalTexel = texture2D(normalMap, v_Texcoord).xyz;\n if (dot(normalTexel, normalTexel) > 0.0) { N = normalTexel * 2.0 - 1.0;\n mat3 tbn = mat3(v_Tangent, v_Bitangent, v_Normal);\n N = normalize(tbn * N);\n }\n }\n#endif\n N = vec3(N.x, N[NORMAL_UP_AXIS], N[NORMAL_FRONT_AXIS]);\n\n vec3 diffuseTerm = vec3(0.0);\n vec3 specularTerm = vec3(0.0);\n\n float ndv = clamp(dot(N, V), 0.0, 1.0);\n vec3 fresnelTerm = F_Schlick(ndv, specFactor);\n\n @import ecgl.common.ssaoMap.main\n\n#ifdef AMBIENT_LIGHT_COUNT\n for(int _idx_ = 0; _idx_ < AMBIENT_LIGHT_COUNT; _idx_++)\n {{\n diffuseTerm += ambientLightColor[_idx_] * ambientFactor * ao;\n }}\n#endif\n\n#ifdef AMBIENT_SH_LIGHT_COUNT\n for(int _idx_ = 0; _idx_ < AMBIENT_SH_LIGHT_COUNT; _idx_++)\n {{\n diffuseTerm += calcAmbientSHLight(_idx_, N) * ambientSHLightColor[_idx_] * ao;\n }}\n#endif\n\n#ifdef DIRECTIONAL_LIGHT_COUNT\n#if defined(DIRECTIONAL_LIGHT_SHADOWMAP_COUNT)\n float shadowContribsDir[DIRECTIONAL_LIGHT_COUNT];\n if(shadowEnabled)\n {\n computeShadowOfDirectionalLights(v_WorldPosition, shadowContribsDir);\n }\n#endif\n for(int _idx_ = 0; _idx_ < DIRECTIONAL_LIGHT_COUNT; _idx_++)\n {{\n vec3 L = -directionalLightDirection[_idx_];\n vec3 lc = directionalLightColor[_idx_];\n\n vec3 H = normalize(L + V);\n float ndl = clamp(dot(N, normalize(L)), 0.0, 1.0);\n float ndh = clamp(dot(N, H), 0.0, 1.0);\n\n float shadowContrib = 1.0;\n#if defined(DIRECTIONAL_LIGHT_SHADOWMAP_COUNT)\n if (shadowEnabled)\n {\n shadowContrib = shadowContribsDir[_idx_];\n }\n#endif\n\n vec3 li = lc * ndl * shadowContrib;\n\n diffuseTerm += li;\n specularTerm += li * fresnelTerm * D_Phong(g, ndh);\n }}\n#endif\n\n\n#ifdef AMBIENT_CUBEMAP_LIGHT_COUNT\n vec3 L = reflect(-V, N);\n float rough2 = clamp(1.0 - g, 0.0, 1.0);\n float bias2 = rough2 * 5.0;\n vec2 brdfParam2 = texture2D(ambientCubemapLightBRDFLookup[0], vec2(rough2, ndv)).xy;\n vec3 envWeight2 = specFactor * brdfParam2.x + brdfParam2.y;\n vec3 envTexel2;\n for(int _idx_ = 0; _idx_ < AMBIENT_CUBEMAP_LIGHT_COUNT; _idx_++)\n {{\n envTexel2 = RGBMDecode(textureCubeLodEXT(ambientCubemapLightCubemap[_idx_], L, bias2), 51.5);\n specularTerm += ambientCubemapLightColor[_idx_] * envTexel2 * envWeight2 * ao;\n }}\n#endif\n\n gl_FragColor.rgb = albedoColor.rgb * diffuseTerm + specularTerm;\n gl_FragColor.a = albedoColor.a;\n\n#ifdef SRGB_ENCODE\n gl_FragColor = linearTosRGB(gl_FragColor);\n#endif\n\n @import ecgl.common.emissiveLayer.main\n\n @import ecgl.common.wireframe.fragmentMain\n}\n\n@end";
